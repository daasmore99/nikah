-- Pengerasan keamanan: rate limit login/demo + penguncian fungsi + kuota demo.
-- Aman dijalankan ulang (idempoten). TIDAK mengubah isi tabel data asli.
-- Butuh: 20261114000000_init.sql, 20261115010000_demo_public.sql, 20261116000000_demo_workspace.sql.
--
-- File ini terdiri dari 4 BAGIAN yang masing-masing bisa di-Run sendiri di SQL Editor, berurutan:
--   BAGIAN 1: tabel rl_bucket + fungsi rl_check / rl_hit / rl_clear_login (rate limit)
--   BAGIAN 2: penguncian fungsi & hak akses yang sudah ada (search_path, execute anon)
--   BAGIAN 3: kuota demo (ruang harus terdaftar, ukuran baris, batas global, purge otomatis)
--   BAGIAN 4: pemeriksaan (hanya SELECT, tidak mengubah apa pun)
-- Aplikasi tetap jalan sebelum file ini dijalankan: rate limit jatuh ke memori per instance.

-- ===================== BAGIAN 1: rate limit =====================
-- Kunci disimpan sebagai sha256 hex (bukan email/IP mentah). Tabel tertutup total:
-- RLS aktif tanpa policy + semua hak dicabut; hanya fungsi security definer di bawah yang menyentuhnya.
-- Kebijakan (harus sama dengan RL_POLICIES di src/lib/security/ratelimit.ts):
--   login-ip        20 gagal / 15 mnt -> jeda 5 mnt, berlipat dua, maks. 60 mnt
--   login-email-ip   5 gagal / 15 mnt -> jeda 1 mnt, berlipat dua, maks. 30 mnt
--   login-email     30 gagal / 15 mnt -> jeda 5 mnt, berlipat dua, maks. 30 mnt
--   demo-write     150 tulis / 10 mnt -> jeda 5 mnt, berlipat dua, maks. 30 mnt
--   demo-ws         10 ruang baru / jam -> jeda 60 mnt, berlipat dua, maks. 6 jam
-- Tidak ada kunci permanen: jeda selalu berakhir sendiri.

create table if not exists public.rl_bucket (
  scope         text not null,
  key           text not null,
  hits          integer not null default 0,
  window_start  timestamptz not null default now(),
  strikes       integer not null default 0,
  blocked_until timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (scope, key),
  constraint rl_bucket_key_hex check (key ~ '^[0-9a-f]{64}$')
);
create index if not exists rl_bucket_updated_idx on public.rl_bucket (updated_at);
alter table public.rl_bucket enable row level security;
revoke all on public.rl_bucket from public, anon, authenticated;

create or replace function public.rl_policy(p_scope text, out lim int, out win int, out blk int, out max_blk int)
language sql immutable set search_path = '' as $$
  select v.lim, v.win, v.blk, v.max_blk
  from (values
    ('login-ip',       20,  900,  300,  3600),
    ('login-email-ip',  5,  900,   60,  1800),
    ('login-email',    30,  900,  300,  1800),
    ('demo-write',    150,  600,  300,  1800),
    ('demo-ws',        10, 3600, 3600, 21600)
  ) as v(scope, lim, win, blk, max_blk)
  where v.scope = p_scope;
$$;
revoke all on function public.rl_policy(text) from public, anon, authenticated;

-- Detik tunggu kalau key sedang dijeda, 0 kalau boleh. Hanya membaca.
create or replace function public.rl_check(p_scope text, p_key text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare v_until timestamptz;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    return 0;
  end if;
  select b.blocked_until into v_until from public.rl_bucket b where b.scope = p_scope and b.key = p_key;
  if v_until is null or v_until <= now() then
    return 0;
  end if;
  return ceil(extract(epoch from (v_until - now())))::int;
end;
$$;

-- Catat satu kejadian (login gagal / tulis demo). Hasil > 0 = sedang/baru saja dijeda (detik).
create or replace function public.rl_hit(p_scope text, p_key text) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  p       record;
  b       public.rl_bucket%rowtype;
  v_now   timestamptz := clock_timestamp();
  v_block integer := 0;
begin
  select * into p from public.rl_policy(p_scope);
  if p.lim is null or p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    return 0;
  end if;
  -- rem darurat terhadap pembengkakan tabel (kunci acak dari pemanggil langsung): gagal terbuka
  if (select c.reltuples from pg_catalog.pg_class c where c.oid = 'public.rl_bucket'::regclass) > 200000 then
    return 0;
  end if;
  insert into public.rl_bucket (scope, key, hits, window_start, strikes, blocked_until, updated_at)
  values (p_scope, p_key, 0, v_now, 0, null, v_now)
  on conflict (scope, key) do nothing;
  select * into b from public.rl_bucket where scope = p_scope and key = p_key for update;
  if b.blocked_until is not null and b.blocked_until > v_now then
    return ceil(extract(epoch from (b.blocked_until - v_now)))::int;
  end if;
  if v_now - b.window_start >= make_interval(secs => p.win) then
    if v_now - b.window_start >= interval '1 day' then
      b.strikes := 0;
    end if;
    b.hits := 0;
    b.window_start := v_now;
  end if;
  b.hits := b.hits + 1;
  if b.hits >= p.lim then
    v_block := least(p.max_blk::numeric, p.blk::numeric * power(2::numeric, least(b.strikes, 20)))::int;
    b.blocked_until := v_now + make_interval(secs => v_block);
    b.strikes := b.strikes + 1;
    b.hits := 0;
    b.window_start := v_now;
  end if;
  update public.rl_bucket
     set hits = b.hits, window_start = b.window_start, strikes = b.strikes,
         blocked_until = b.blocked_until, updated_at = v_now
   where scope = p_scope and key = p_key;
  -- bersih-bersih ringan (sekitar 2% panggilan): baris lama yang tidak sedang dijeda
  if random() < 0.02 then
    delete from public.rl_bucket
     where updated_at < v_now - interval '2 days'
       and (blocked_until is null or blocked_until < v_now);
  end if;
  return v_block;
end;
$$;

-- Setelah login berhasil: hapus hitungan gagal untuk email PEMILIK SESI saja (dari JWT).
-- Bentuk kunci sama dengan rlKeys di src/lib/security/ratelimit.ts.
create or replace function public.rl_clear_login(p_ip text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email = '' then
    return;
  end if;
  delete from public.rl_bucket
   where (scope = 'login-email' and key = encode(sha256(convert_to('e:' || v_email, 'UTF8')), 'hex'))
      or (scope = 'login-email-ip' and p_ip is not null and length(p_ip) <= 45
          and key = encode(sha256(convert_to('ei:' || v_email || '|' || p_ip, 'UTF8')), 'hex'));
end;
$$;

revoke all on function public.rl_check(text, text) from public;
revoke all on function public.rl_hit(text, text) from public;
revoke all on function public.rl_clear_login(text) from public, anon;
-- login terjadi SEBELUM ada sesi, jadi rl_check/rl_hit harus bisa dipanggil anon.
-- Keduanya hanya menambah hitungan / membaca jeda; tidak ada yang bisa me-reset kunci orang lain.
grant execute on function public.rl_check(text, text) to anon, authenticated;
grant execute on function public.rl_hit(text, text) to anon, authenticated;
grant execute on function public.rl_clear_login(text) to authenticated;

notify pgrst, 'reload schema';

-- ===================== BAGIAN 2: penguncian fungsi & hak akses =====================
-- Supabase memberi EXECUTE ke anon/authenticated untuk fungsi baru di public secara default,
-- jadi "revoke ... from public" saja tidak cukup. Trigger tetap jalan tanpa hak EXECUTE.

-- search_path tetap (lint Supabase: function_search_path_mutable). Isi fungsi hanya memakai
-- now() (pg_catalog) dan auth.uid() (sudah berskema), jadi search_path kosong aman.
alter function public.set_audit() set search_path = '';
alter function public.set_updated() set search_path = '';

revoke all on function public.set_audit() from public, anon, authenticated;
revoke all on function public.set_updated() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- is_anggota / is_penonton / demo_ws hanya untuk user login (dipakai policy RLS & aplikasi)
revoke all on function public.is_anggota() from public, anon;
grant execute on function public.is_anggota() to authenticated;
revoke all on function public.is_penonton() from public, anon;
grant execute on function public.is_penonton() to authenticated;
revoke all on function public.demo_ws() from public, anon;
grant execute on function public.demo_ws() to authenticated;
revoke all on function public.reset_demo() from public, anon;
grant execute on function public.reset_demo() to authenticated;
revoke all on function public.purge_demo(interval) from public, anon, authenticated;
revoke all on function public.demo_batas_ws() from public, anon, authenticated;

-- anggota / profil / penonton hanya dibaca (policy select); tulis hanya lewat SQL Editor
revoke insert, update, delete, truncate, references, trigger on public.anggota from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.profil from anon, authenticated;
revoke all on public.penonton from public, anon, authenticated;

-- Tabel data asli & demo: tidak ada hak untuk anon, tidak ada TRUNCATE/TRIGGER/REFERENCES untuk siapa pun via API
do $$
declare t text;
begin
  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor','seserahan_rekom',
                           'katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    execute format('revoke all on public.%I from anon', 'demo_' || t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', 'demo_' || t);
  end loop;
end $$;

-- Skema `demo` lama (v1) tidak dipakai lagi dan TIDAK punya batas ukuran. Tutup aksesnya
-- (tanpa menghapus isi). Hapus permanen nanti kalau sudah yakin: drop schema demo cascade;
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'demo') then
    execute 'revoke all on all tables in schema demo from public, anon, authenticated';
    execute 'revoke usage on schema demo from public, anon, authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';

-- ===================== BAGIAN 3: kuota demo =====================
-- Kredensial demo dibagikan, jadi siapa pun bisa memanggil Data API langsung (tanpa aplikasi)
-- dengan uuid ruang acak. Batas di DATABASE ini yang berlaku untuk semua jalur:
--   * baris di tabel demo_* selain demo_pengaturan hanya boleh untuk ruang yang terdaftar
--   * ukuran satu baris maks. 3 KB (aplikasi membatasi tiap teks 2000 karakter)
--   * maks. 500 baris per tabel per ruang (sudah ada), maks. 8000 baris per tabel total
--   * maks. 400 ruang; kalau penuh, ruang yang tidak berubah > 1 hari dibersihkan otomatis dulu
-- Perkiraan terburuk: 12 tabel x 8000 baris x 3 KB = kurang dari 300 MB (kuota gratis 500 MB).

create or replace function public.demo_batas_ws() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n bigint;
begin
  if new.ws is null then
    return new; -- NOT NULL / RLS yang menolak
  end if;
  if octet_length(row_to_json(new)::text) > 3072 then
    raise exception 'Isian demo terlalu panjang' using errcode = '54000';
  end if;
  if tg_op = 'UPDATE' then
    return new;
  end if;

  if tg_table_name = 'demo_pengaturan' then
    if not exists (select 1 from public.demo_pengaturan p where p.ws = new.ws) then
      select count(*) into n from public.demo_pengaturan;
      if n >= 400 then
        perform public.purge_demo('1 day');
        select count(*) into n from public.demo_pengaturan;
        if n >= 400 then
          raise exception 'Kuota demo penuh' using errcode = '54000';
        end if;
      end if;
    end if;
  elsif not exists (select 1 from public.demo_pengaturan p where p.ws = new.ws) then
    raise exception 'Ruang demo tidak dikenali' using errcode = '42501';
  end if;

  execute format('select count(*) from %I.%I where ws = $1', tg_table_schema, tg_table_name)
    into n using new.ws;
  if n >= 500 then
    raise exception 'Batas data demo tercapai' using errcode = '54000';
  end if;
  execute format('select count(*) from %I.%I', tg_table_schema, tg_table_name) into n;
  if n >= 8000 then
    raise exception 'Kuota demo penuh' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function public.demo_batas_ws() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                           'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('drop trigger if exists %1$I on public.%2$I', 'demo_' || t || '_batas', 'demo_' || t);
    execute format('create trigger %1$I before insert or update on public.%2$I
                    for each row execute function public.demo_batas_ws()', 'demo_' || t || '_batas', 'demo_' || t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Opsional (disarankan): bersihkan ruang demo yang tidak dipakai 3 hari, tiap malam.
-- Butuh extension pg_cron (Database -> Extensions). Migrasi ini TIDAK menjalankannya:
--   select cron.schedule('purge-demo', '17 3 * * *', $c$select public.purge_demo('3 days')$c$);
-- Bersihkan juga baris rate limit lama:
--   select cron.schedule('purge-rl', '27 3 * * *', $c$delete from public.rl_bucket where updated_at < now() - interval '2 days'$c$);

-- ===================== BAGIAN 4: pemeriksaan (hanya membaca) =====================
-- Hasil yang diharapkan: query pertama dan kedua KOSONG.

-- 4a. tabel di public tanpa RLS
select c.relname as tabel_tanpa_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 4b. tabel di public yang masih bisa dibaca/ditulis anon
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';

-- 4c. fungsi di public yang bisa dieksekusi anon (yang wajar: rl_check, rl_hit)
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
order by 1;

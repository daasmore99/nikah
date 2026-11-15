-- Akun demo v3: ruang data (workspace) TERPISAH PER PENGUNJUNG.
-- Semua pengunjung memakai kredensial demo yang sama, tapi tiap browser punya uuid acak
-- (cookie httpOnly `demo_ws`) yang dikirim aplikasi sebagai header `x-demo-ws` ke PostgREST.
-- Tiap baris public.demo_* menyimpan kolom `ws`; RLS hanya membuka baris dengan ws = header.
--
-- ISOLASI BERBASIS KAPABILITAS, BUKAN IDENTITAS: siapa pun yang tahu uuid sebuah ruang bisa
-- membaca/menulis ruang itu (uuid acak 122-bit, praktis tak bisa ditebak). Cukup untuk data
-- demo coba-coba, BUKAN untuk menyimpan rahasia. Data asli (public.* tanpa awalan demo_)
-- tetap dilindungi policy anggota_* dan tidak disentuh migrasi ini.
--
-- Butuh: 20261115010000_demo_public.sql sudah dijalankan. Aman dijalankan ulang (idempoten).
-- File ini terdiri dari 3 BAGIAN yang masing-masing bisa di-Run sendiri di SQL Editor, berurutan:
-- BAGIAN 1 (demo_ws + kolom ws), BAGIAN 2 (RLS per ruang + batas ukuran), BAGIAN 3 (reset + purge).

-- ===================== BAGIAN 1: demo_ws() + kolom ws =====================

-- uuid ruang dari header x-demo-ws (PostgREST menaruh semua header request di GUC
-- request.headers sebagai JSON). Tidak pernah melempar error: setting tidak ada, JSON rusak,
-- atau bukan uuid -> null. plpgsql (bukan sql) karena butuh blok exception.
create or replace function public.demo_ws() returns uuid
language plpgsql stable security invoker set search_path = pg_catalog, pg_temp as $$
declare v text;
begin
  v := nullif(current_setting('request.headers', true), '')::json ->> 'x-demo-ws';
  if v is null or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v::uuid;
exception when others then
  return null;
end;
$$;
revoke all on function public.demo_ws() from public;
revoke all on function public.demo_ws() from anon;
grant execute on function public.demo_ws() to authenticated;

-- DATA DEMO BERSIFAT SEKALI PAKAI: semua isi demo_* dikosongkan di sini, supaya kolom ws bisa
-- langsung NOT NULL (baris lama tidak punya ruang). Tabel data ASLI tidak disentuh.
-- Kalau kolom ws sudah ada (migrasi ini dijalankan ulang), TIDAK dikosongkan lagi.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'demo_pengaturan' and column_name = 'ws'
  ) then
    truncate public.demo_pengaturan, public.demo_setoran, public.demo_pengeluaran, public.demo_biaya_item,
             public.demo_todo, public.demo_vendor, public.demo_seserahan_rekom, public.demo_katalog,
             public.demo_tamu, public.demo_tamu_kelompok, public.demo_lagu, public.demo_lagu_rekom;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                           'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('alter table public.%I add column if not exists ws uuid not null default public.demo_ws()', 'demo_' || t);
    execute format('create index if not exists %I on public.%I (ws)', 'demo_' || t || '_ws_idx', 'demo_' || t);
  end loop;
end $$;

-- demo_pengaturan: SATU BARIS PER RUANG. PK id / check (id = 1) yang tersalin dari tabel asli
-- dilepas (hanya di tabel demo), PK pindah ke ws. Kolom id tetap ada, default 1, tanpa unik.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.demo_pengaturan'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\mid\M\s*=\s*1'
  loop
    execute format('alter table public.demo_pengaturan drop constraint %I', c.conname);
  end loop;

  for c in
    select con.conname, array_agg(a.attname::text) as cols
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where con.conrelid = 'public.demo_pengaturan'::regclass and con.contype = 'p'
    group by con.conname
  loop
    if c.cols <> array['ws'] then
      execute format('alter table public.demo_pengaturan drop constraint %I', c.conname);
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint where conrelid = 'public.demo_pengaturan'::regclass and contype = 'p'
  ) then
    alter table public.demo_pengaturan add constraint demo_pengaturan_ws_pkey primary key (ws);
  end if;
end $$;
alter table public.demo_pengaturan alter column id set default 1;

notify pgrst, 'reload schema';

-- ===================== BAGIAN 2: RLS per ruang + batas ukuran =====================
-- Butuh BAGIAN 1. Semua policy penonton_* diganti: hanya akun penonton, dan hanya baris
-- dengan ws = public.demo_ws(). Tanpa header x-demo-ws = tidak ada baris sama sekali.
-- (select ...) membuat fungsi dievaluasi sekali per query, bukan per baris.

do $$
declare
  t text;
  cek text := '(select public.is_penonton()) and (select public.demo_ws()) is not null and ws = (select public.demo_ws())';
begin
  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                           'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('alter table public.%I enable row level security', 'demo_' || t);
    execute format('revoke all on public.%I from public, anon', 'demo_' || t);
    execute format('drop policy if exists "penonton_select" on public.%I', 'demo_' || t);
    execute format('drop policy if exists "penonton_insert" on public.%I', 'demo_' || t);
    execute format('drop policy if exists "penonton_update" on public.%I', 'demo_' || t);
    execute format('drop policy if exists "penonton_delete" on public.%I', 'demo_' || t);
    execute format('create policy "penonton_select" on public.%I for select to authenticated using (%s)', 'demo_' || t, cek);
    execute format('create policy "penonton_insert" on public.%I for insert to authenticated with check (%s)', 'demo_' || t, cek);
    execute format('create policy "penonton_update" on public.%I for update to authenticated using (%s) with check (%s)', 'demo_' || t, cek, cek);
    execute format('create policy "penonton_delete" on public.%I for delete to authenticated using (%s)', 'demo_' || t, cek);
    execute format('grant select, insert, update, delete on public.%I to authenticated', 'demo_' || t);
  end loop;
end $$;

-- pengaturan demo tidak boleh dihapus lewat API (reset memakai reset_demo)
drop policy if exists "penonton_delete" on public.demo_pengaturan;

-- Batas ukuran: maksimal 500 baris per tabel per ruang (ws). Trigger audit lama tetap.
create or replace function public.demo_batas_ws() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n bigint;
begin
  if new.ws is null then
    return new; -- NOT NULL / RLS yang menolak
  end if;
  execute format('select count(*) from %I.%I where ws = $1', tg_table_schema, tg_table_name)
    into n using new.ws;
  if n >= 500 then
    raise exception 'Batas data demo tercapai' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function public.demo_batas_ws() from public;
revoke all on function public.demo_batas_ws() from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                           'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('drop trigger if exists %1$I on public.%2$I', 'demo_' || t || '_batas', 'demo_' || t);
    execute format('create trigger %1$I before insert on public.%2$I
                    for each row execute function public.demo_batas_ws()', 'demo_' || t || '_batas', 'demo_' || t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ===================== BAGIAN 3: reset_demo (ruang sendiri) + purge_demo =====================
-- Butuh BAGIAN 1. reset_demo hanya mengosongkan ruang pemanggil (ws dari header), TIDAK lagi
-- truncate semua. Ruang pengunjung lain tidak tersentuh. Tabel asli tidak pernah disentuh.

create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ws uuid := public.demo_ws();
begin
  if not public.is_penonton() then
    raise exception 'Reset hanya untuk akun demo' using errcode = '42501';
  end if;
  if v_ws is null then
    raise exception 'Ruang demo tidak dikenali (header x-demo-ws kosong)' using errcode = '42501';
  end if;
  delete from public.demo_setoran         where ws = v_ws;
  delete from public.demo_pengeluaran     where ws = v_ws;
  delete from public.demo_biaya_item      where ws = v_ws;
  delete from public.demo_todo            where ws = v_ws;
  delete from public.demo_vendor          where ws = v_ws;
  delete from public.demo_seserahan_rekom where ws = v_ws;
  delete from public.demo_katalog         where ws = v_ws;
  delete from public.demo_tamu            where ws = v_ws;
  delete from public.demo_tamu_kelompok   where ws = v_ws;
  delete from public.demo_lagu            where ws = v_ws;
  delete from public.demo_lagu_rekom      where ws = v_ws;
  delete from public.demo_pengaturan      where ws = v_ws;
  insert into public.demo_pengaturan (ws, id, nama_pria, nama_wanita, tanggal_nikah, target_dana)
  values (v_ws, 1, '', '', null, 0)
  on conflict (ws) do nothing;
end;
$$;
revoke all on function public.reset_demo() from public;
revoke all on function public.reset_demo() from anon;
grant execute on function public.reset_demo() to authenticated;

-- Pembersih ruang terbengkalai: hapus semua baris demo milik ruang yang perubahan TERAKHIRNYA
-- (max(updated_at) di semua tabel demo_*) lebih lama dari `retain`. Hasil: jumlah ruang terhapus.
-- TIDAK bisa dipanggil lewat API (execute dicabut); jalankan manual di SQL Editor:
--   select public.purge_demo();            -- default 30 hari
--   select public.purge_demo('7 days');
-- Opsional, kalau extension pg_cron aktif (Database -> Extensions), jadwalkan harian:
--   select cron.schedule('purge-demo', '17 3 * * *', $c$select public.purge_demo()$c$);
-- Migrasi ini TIDAK mengaktifkan pg_cron dan tidak membuat jadwal apa pun.
create or replace function public.purge_demo(retain interval default '30 days') returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t text;
  tabel text[] := array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                        'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom'];
  basi uuid[];
  q text := '';
begin
  foreach t in array tabel loop
    q := q || case when q = '' then '' else ' union all ' end
           || format('select ws, updated_at from public.%I', 'demo_' || t);
  end loop;
  execute format('select coalesce(array_agg(ws), array[]::uuid[]) from (
                    select ws from (%s) s group by ws having max(updated_at) < now() - $1) x', q)
    into basi using retain;
  if cardinality(basi) = 0 then
    return 0;
  end if;
  foreach t in array tabel loop
    execute format('delete from public.%I where ws = any ($1)', 'demo_' || t) using basi;
  end loop;
  return cardinality(basi);
end;
$$;
revoke all on function public.purge_demo(interval) from public;
revoke all on function public.purge_demo(interval) from anon, authenticated;

notify pgrst, 'reload schema';

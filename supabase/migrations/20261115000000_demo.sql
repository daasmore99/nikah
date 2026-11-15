-- Akun demo: penyimpanan terpisah di skema `demo`, mulai kosong.
-- Aman dijalankan ulang (idempoten). Tidak mengubah tabel public.* yang sudah ada.
--
-- Siapa akun demo: email di public.penonton (satu-satunya sumber kebenaran).
-- Akun demo TIDAK boleh ada di public.anggota, jadi RLS public.* tetap menolaknya.
-- Anggota asli tidak bisa membaca skema demo kecuali emailnya juga dimasukkan ke penonton.
--
-- Setelah Run: Project Settings > API (Data API) > Exposed schemas: tambahkan `demo`.

-- ---------- penonton (allowlist email akun demo) ----------
create table if not exists public.penonton (
  email text primary key check (email = lower(email))
);
alter table public.penonton enable row level security;
-- tidak ada policy: tabel ini hanya dibaca lewat fungsi security definer di bawah
revoke all on public.penonton from anon, authenticated;

create or replace function public.is_penonton() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.penonton p
    where p.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_penonton() from public;
revoke all on function public.is_penonton() from anon;
grant execute on function public.is_penonton() to authenticated;

-- ---------- skema demo: salinan struktur tabel data ----------
create schema if not exists demo;
revoke all on schema demo from public, anon;
grant usage on schema demo to authenticated;

-- LIKE ... INCLUDING ALL menyalin kolom, default, NOT NULL, CHECK, PK/UNIQUE, index.
-- Foreign key ke auth.users tidak ikut tersalin (tidak dibutuhkan untuk demo).
create table if not exists demo.pengaturan      (like public.pengaturan      including all);
create table if not exists demo.setoran         (like public.setoran         including all);
create table if not exists demo.pengeluaran     (like public.pengeluaran     including all);
create table if not exists demo.biaya_item      (like public.biaya_item      including all);
create table if not exists demo.todo            (like public.todo            including all);
create table if not exists demo.vendor          (like public.vendor          including all);
create table if not exists demo.seserahan_rekom (like public.seserahan_rekom including all);
create table if not exists demo.katalog         (like public.katalog         including all);
create table if not exists demo.tamu            (like public.tamu            including all);
create table if not exists demo.tamu_kelompok   (like public.tamu_kelompok   including all);
create table if not exists demo.lagu            (like public.lagu            including all);
create table if not exists demo.lagu_rekom      (like public.lagu_rekom      including all);

-- Pengaturan demo mulai KOSONG: tidak ada nama, tanggal, atau target dari data asli.
alter table demo.pengaturan alter column nama_pria set default '';
alter table demo.pengaturan alter column nama_wanita set default '';
alter table demo.pengaturan alter column tanggal_nikah drop not null;
alter table demo.pengaturan alter column tanggal_nikah drop default;
alter table demo.pengaturan alter column target_dana set default 0;
insert into demo.pengaturan (id, nama_pria, nama_wanita, tanggal_nikah, target_dana)
values (1, '', '', null, 0)
on conflict (id) do nothing;

-- ---------- trigger audit + RLS ----------
drop trigger if exists pengaturan_audit on demo.pengaturan;
create trigger pengaturan_audit before insert or update on demo.pengaturan
  for each row execute function public.set_updated();

do $$
declare t text;
begin
  foreach t in array array['setoran','pengeluaran','biaya_item','todo','vendor','seserahan_rekom',
                           'katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('drop trigger if exists %1$s_audit on demo.%1$I', t);
    execute format('create trigger %1$s_audit before insert or update on demo.%1$I
                    for each row execute function public.set_audit()', t);
  end loop;

  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                           'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('alter table demo.%I enable row level security', t);
    execute format('revoke all on demo.%I from public, anon', t);
    execute format('drop policy if exists "penonton_select" on demo.%I', t);
    execute format('drop policy if exists "penonton_insert" on demo.%I', t);
    execute format('drop policy if exists "penonton_update" on demo.%I', t);
    execute format('drop policy if exists "penonton_delete" on demo.%I', t);
    execute format('create policy "penonton_select" on demo.%I for select to authenticated using (public.is_penonton())', t);
    execute format('create policy "penonton_insert" on demo.%I for insert to authenticated with check (public.is_penonton())', t);
    execute format('create policy "penonton_update" on demo.%I for update to authenticated using (public.is_penonton()) with check (public.is_penonton())', t);
    execute format('create policy "penonton_delete" on demo.%I for delete to authenticated using (public.is_penonton())', t);
    execute format('grant select, insert, update, delete on demo.%I to authenticated', t);
  end loop;
end $$;

-- pengaturan demo tidak boleh dihapus lewat API (reset memakai reset_demo)
drop policy if exists "penonton_delete" on demo.pengaturan;

-- ---------- reset ----------
create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_penonton() then
    raise exception 'Reset hanya untuk akun demo' using errcode = '42501';
  end if;
  truncate demo.setoran, demo.pengeluaran, demo.biaya_item, demo.todo, demo.vendor, demo.seserahan_rekom,
           demo.katalog, demo.tamu, demo.tamu_kelompok, demo.lagu, demo.lagu_rekom;
  delete from demo.pengaturan;
  insert into demo.pengaturan (id, nama_pria, nama_wanita, tanggal_nikah, target_dana) values (1, '', '', null, 0);
end;
$$;
revoke all on function public.reset_demo() from public;
revoke all on function public.reset_demo() from anon;
grant execute on function public.reset_demo() to authenticated;

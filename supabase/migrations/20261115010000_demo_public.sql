-- Akun demo v2: tabel berawalan demo_ di skema public (sudah terbuka ke Data API).
-- Menggantikan skema `demo` (20261115000000_demo.sql) yang butuh "Exposed schemas".
-- Aman dijalankan ulang (idempoten). Tidak mengubah tabel data asli public.*.
--
-- File ini terdiri dari 3 BAGIAN yang masing-masing bisa di-Run sendiri di SQL Editor,
-- berurutan: BAGIAN 1 (tabel + pengaturan), BAGIAN 2 (trigger + RLS), BAGIAN 3 (reset_demo).
--
-- Skema `demo` lama TIDAK dipakai lagi oleh aplikasi. Sengaja tidak di-drop otomatis.
-- Kalau sudah yakin, hapus manual nanti:  drop schema if exists demo cascade;

-- ===================== BAGIAN 1: tabel + pengaturan demo =====================

-- penonton & is_penonton sudah dibuat oleh 20261115000000_demo.sql; baris di bawah
-- hanya memastikan keduanya ada (definisi identik, isi tabel penonton tidak disentuh).
create table if not exists public.penonton (
  email text primary key check (email = lower(email))
);
alter table public.penonton enable row level security;
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

-- LIKE ... INCLUDING ALL menyalin kolom, default, NOT NULL, CHECK, PK/UNIQUE, index.
-- Foreign key ke auth.users tidak ikut tersalin (tidak dibutuhkan untuk demo).
create table if not exists public.demo_pengaturan      (like public.pengaturan      including all);
create table if not exists public.demo_setoran         (like public.setoran         including all);
create table if not exists public.demo_pengeluaran     (like public.pengeluaran     including all);
create table if not exists public.demo_biaya_item      (like public.biaya_item      including all);
create table if not exists public.demo_todo            (like public.todo            including all);
create table if not exists public.demo_vendor          (like public.vendor          including all);
create table if not exists public.demo_seserahan_rekom (like public.seserahan_rekom including all);
create table if not exists public.demo_katalog         (like public.katalog         including all);
create table if not exists public.demo_tamu            (like public.tamu            including all);
create table if not exists public.demo_tamu_kelompok   (like public.tamu_kelompok   including all);
create table if not exists public.demo_lagu            (like public.lagu            including all);
create table if not exists public.demo_lagu_rekom      (like public.lagu_rekom      including all);

-- Pengaturan demo mulai KOSONG: tidak ada nama, tanggal, atau target dari data asli.
alter table public.demo_pengaturan alter column nama_pria set default '';
alter table public.demo_pengaturan alter column nama_wanita set default '';
alter table public.demo_pengaturan alter column tanggal_nikah drop not null;
alter table public.demo_pengaturan alter column tanggal_nikah drop default;
alter table public.demo_pengaturan alter column target_dana set default 0;
insert into public.demo_pengaturan (id, nama_pria, nama_wanita, tanggal_nikah, target_dana)
values (1, '', '', null, 0)
on conflict (id) do nothing;

-- Kunci dulu: RLS aktif tanpa policy = tidak ada baris yang terbaca/tertulis lewat API
-- sampai BAGIAN 2 dijalankan. anon tidak pernah punya hak.
do $$
declare t text;
begin
  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                           'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('alter table public.%I enable row level security', 'demo_' || t);
    execute format('revoke all on public.%I from public, anon', 'demo_' || t);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ===================== BAGIAN 2: trigger audit + RLS + policy =====================
-- Butuh BAGIAN 1. Hanya akun di public.penonton yang bisa membaca/menulis demo_*.
-- Anggota asli TIDAK bisa membaca demo_* (kecuali emailnya juga dimasukkan ke penonton),
-- dan akun penonton tetap ditolak RLS tabel asli (policy anggota_* memakai is_anggota()).

drop trigger if exists demo_pengaturan_audit on public.demo_pengaturan;
create trigger demo_pengaturan_audit before insert or update on public.demo_pengaturan
  for each row execute function public.set_updated();

do $$
declare t text;
begin
  foreach t in array array['setoran','pengeluaran','biaya_item','todo','vendor','seserahan_rekom',
                           'katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('drop trigger if exists %1$I on public.%2$I', 'demo_' || t || '_audit', 'demo_' || t);
    execute format('create trigger %1$I before insert or update on public.%2$I
                    for each row execute function public.set_audit()', 'demo_' || t || '_audit', 'demo_' || t);
  end loop;

  foreach t in array array['pengaturan','setoran','pengeluaran','biaya_item','todo','vendor',
                           'seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('alter table public.%I enable row level security', 'demo_' || t);
    execute format('revoke all on public.%I from public, anon', 'demo_' || t);
    execute format('drop policy if exists "penonton_select" on public.%I', 'demo_' || t);
    execute format('drop policy if exists "penonton_insert" on public.%I', 'demo_' || t);
    execute format('drop policy if exists "penonton_update" on public.%I', 'demo_' || t);
    execute format('drop policy if exists "penonton_delete" on public.%I', 'demo_' || t);
    execute format('create policy "penonton_select" on public.%I for select to authenticated using (public.is_penonton())', 'demo_' || t);
    execute format('create policy "penonton_insert" on public.%I for insert to authenticated with check (public.is_penonton())', 'demo_' || t);
    execute format('create policy "penonton_update" on public.%I for update to authenticated using (public.is_penonton()) with check (public.is_penonton())', 'demo_' || t);
    execute format('create policy "penonton_delete" on public.%I for delete to authenticated using (public.is_penonton())', 'demo_' || t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', 'demo_' || t);
  end loop;
end $$;

-- pengaturan demo tidak boleh dihapus lewat API (reset memakai reset_demo)
drop policy if exists "penonton_delete" on public.demo_pengaturan;

notify pgrst, 'reload schema';

-- ===================== BAGIAN 3: reset_demo =====================
-- Butuh BAGIAN 1. Mengganti versi lama (yang mengosongkan skema demo) dengan versi demo_*.
-- Hanya akun penonton; tabel asli tidak pernah disentuh.

create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_penonton() then
    raise exception 'Reset hanya untuk akun demo' using errcode = '42501';
  end if;
  truncate public.demo_setoran, public.demo_pengeluaran, public.demo_biaya_item, public.demo_todo,
           public.demo_vendor, public.demo_seserahan_rekom, public.demo_katalog, public.demo_tamu,
           public.demo_tamu_kelompok, public.demo_lagu, public.demo_lagu_rekom;
  delete from public.demo_pengaturan;
  insert into public.demo_pengaturan (id, nama_pria, nama_wanita, tanggal_nikah, target_dana)
  values (1, '', '', null, 0);
end;
$$;
revoke all on function public.reset_demo() from public;
revoke all on function public.reset_demo() from anon;
grant execute on function public.reset_demo() to authenticated;

notify pgrst, 'reload schema';

-- Skema awal wedding tracker Ananda & Zalfa.
-- Semua uang disimpan sebagai bigint rupiah (tanpa desimal).
-- Akses: hanya user ter-login yang emailnya terdaftar di public.anggota.

create extension if not exists pgcrypto;

-- ---------- anggota (allowlist email) & profil ----------
create table if not exists public.anggota (
  email text primary key check (email = lower(email)),
  nama  text not null
);

create table if not exists public.profil (
  id    uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nama  text not null
);

create or replace function public.is_anggota() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.anggota a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_anggota() from public;
grant execute on function public.is_anggota() to authenticated;

-- Profil otomatis saat user dibuat di dashboard Supabase.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profil (id, email, nama)
  values (
    new.id,
    lower(new.email),
    coalesce((select a.nama from public.anggota a where a.email = lower(new.email)), split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- kolom umum ----------
-- Tiap tabel data punya: id, urutan, import_key (untuk impor idempoten),
-- created_by (default auth.uid()), updated_by, created_at, updated_at.
create or replace function public.set_audit() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- ---------- pengaturan (satu baris) ----------
create table if not exists public.pengaturan (
  id int primary key default 1 check (id = 1),
  nama_pria text not null default 'Ananda',
  nama_wanita text not null default 'Zalfa',
  tanggal_nikah date not null default '2027-04-10',
  target_dana bigint not null default 70000000 check (target_dana >= 0),
  harga_emas_manual bigint check (harga_emas_manual > 0),
  harga_emas_manual_tgl date,
  harga_emas_terakhir bigint,
  harga_emas_terakhir_at timestamptz,
  souvenir_harga_satuan bigint check (souvenir_harga_satuan >= 0),
  souvenir_jumlah int check (souvenir_jumlah >= 0),
  souvenir_budget bigint check (souvenir_budget >= 0),
  souvenir_blindbox int,
  souvenir_sisa_umma int,
  souvenir_kurang int,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists pengaturan_audit on public.pengaturan;
create trigger pengaturan_audit before insert or update on public.pengaturan
  for each row execute function public.set_updated();

-- ---------- tabel data ----------
create table if not exists public.setoran (
  id uuid primary key default gen_random_uuid(),
  pihak text not null check (pihak in ('CPP', 'CPW')),
  tanggal date,
  jumlah bigint not null check (jumlah > 0),
  lokasi text,
  catatan text,
  saldo_awal boolean not null default false,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pengeluaran (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('gether', 'seserahan')),
  tanggal date,
  jumlah bigint not null check (jumlah > 0),
  keterangan text,
  potong_dana boolean not null default true,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.biaya_item (
  id uuid primary key default gen_random_uuid(),
  grup text not null check (grup in ('Administrasi & MCU', 'Lamaran', 'Mahar', 'Resepsi', 'Seserahan')),
  sub text,
  nama text not null check (length(trim(nama)) > 0),
  estimasi bigint check (estimasi >= 0),
  realisasi bigint check (realisasi >= 0),
  dp bigint check (dp >= 0),
  status text check (status in ('BELUM BAYAR', 'SUDAH DP', 'BELUM LUNAS', 'LUNAS')),
  tanggal_bayar date,
  catatan text,
  link text,
  gram_emas numeric(10, 3) check (gram_emas >= 0),
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.todo (
  id uuid primary key default gen_random_uuid(),
  bagian_no int not null default 0,
  bagian text not null,
  judul text not null check (length(trim(judul)) > 0),
  selesai boolean not null default false,
  tenggat date,
  progres text,
  cpp_selesai boolean,
  cpw_selesai boolean,
  detail text,
  pic text,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor (
  id uuid primary key default gen_random_uuid(),
  kategori text not null,
  nama text not null check (length(trim(nama)) > 0),
  kontak text,
  telepon text,
  instagram_web text,
  alamat text,
  harga bigint check (harga >= 0),
  status text,
  catatan text,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seserahan_rekom (
  id uuid primary key default gen_random_uuid(),
  budget_tier text not null,
  kategori text not null,
  nama text not null,
  harga bigint check (harga >= 0),
  link text,
  dibeli boolean not null default false,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.katalog (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('souvenir', 'undangan_fisik', 'undangan_digital')),
  nama text not null,
  harga bigint check (harga >= 0),
  link text,
  dipilih boolean not null default false,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tamu (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (length(trim(nama)) > 0),
  relasi text,
  jumlah_orang int check (jumlah_orang >= 0),
  status_undangan text,
  konfirmasi text,
  catatan text,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tamu_kelompok (
  id uuid primary key default gen_random_uuid(),
  relasi text not null,
  perkiraan int not null default 0 check (perkiraan >= 0),
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lagu (
  id uuid primary key default gen_random_uuid(),
  judul text,
  keterangan text,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lagu_rekom (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  kategori text,
  link text,
  urutan int not null default 0,
  import_key text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- trigger audit + RLS untuk semua tabel ----------
do $$
declare t text;
begin
  foreach t in array array['setoran','pengeluaran','biaya_item','todo','vendor','seserahan_rekom',
                           'katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('drop trigger if exists %1$s_audit on public.%1$I', t);
    execute format('create trigger %1$s_audit before insert or update on public.%1$I
                    for each row execute function public.set_audit()', t);
  end loop;

  foreach t in array array['anggota','profil','pengaturan','setoran','pengeluaran','biaya_item','todo',
                           'vendor','seserahan_rekom','katalog','tamu','tamu_kelompok','lagu','lagu_rekom']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists "anggota_select" on public.%I', t);
    execute format('drop policy if exists "anggota_insert" on public.%I', t);
    execute format('drop policy if exists "anggota_update" on public.%I', t);
    execute format('drop policy if exists "anggota_delete" on public.%I', t);
    execute format('create policy "anggota_select" on public.%I for select to authenticated using (public.is_anggota())', t);
    if t not in ('anggota', 'profil') then
      execute format('create policy "anggota_insert" on public.%I for insert to authenticated with check (public.is_anggota())', t);
      execute format('create policy "anggota_update" on public.%I for update to authenticated using (public.is_anggota()) with check (public.is_anggota())', t);
      execute format('create policy "anggota_delete" on public.%I for delete to authenticated using (public.is_anggota())', t);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- pengaturan tidak boleh dihapus lewat API
drop policy if exists "anggota_delete" on public.pengaturan;

insert into public.pengaturan (id) values (1) on conflict (id) do nothing;

-- Backfill profil kalau user sudah dibuat sebelum migrasi ini.
insert into public.profil (id, email, nama)
select u.id, lower(u.email), split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

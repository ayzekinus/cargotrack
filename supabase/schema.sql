-- ============================================================
--  CargoTrack — Supabase Database Schema
--  Supabase SQL Editor'a kopyalayıp "Run" butonuna basın
-- ============================================================

-- ── CHASSIS ─────────────────────────────────────────────────
create table if not exists chassis (
  id          text primary key,
  chassis_no  text not null unique,
  plaka_no    text not null,
  tip         text[] not null default '{}'
);

-- ── CONTAINERS ──────────────────────────────────────────────
create table if not exists containers (
  id               text primary key,
  container_no     text not null unique,
  chassis_no       text not null,
  musteri          text not null,
  liman_cikis      date not null,
  liman_giris      date,
  durum            text not null default 'active',
  container_type   text default '20FT',
  kg               text default '',
  adr              boolean default false
);

-- ── HAREKETLER (Movements) ───────────────────────────────────
create table if not exists hareketler (
  id             bigserial primary key,
  container_id   text references containers(id) on delete cascade,
  tarih          date not null,
  surucu         text default '',
  konum          text default '',
  aciklama       text default '',
  km             numeric default 0,
  firma          text default '',
  referans       text default '',
  yuk_durumu     text default 'loaded',
  yuk_notu       text default '',
  surcharges     jsonb default '[]'
);

-- ── FORECAST ────────────────────────────────────────────────
create table if not exists forecast (
  id               text primary key,
  container_no     text not null,
  musteri          text not null,
  liman            text default '',
  tahmini_tarih    date not null,
  aciklama         text default '',
  onem             text default 'normal',
  container_type   text default '20FT',
  kg               text default '',
  adr              boolean default false
);

-- ── ROW LEVEL SECURITY (RLS) ────────────────────────────────
-- Authenticated kullanıcılar tüm tablolara erişebilir
alter table chassis      enable row level security;
alter table containers   enable row level security;
alter table hareketler   enable row level security;
alter table forecast     enable row level security;

create policy "Authenticated full access - chassis"
  on chassis for all using (auth.role() = 'authenticated');

create policy "Authenticated full access - containers"
  on containers for all using (auth.role() = 'authenticated');

create policy "Authenticated full access - hareketler"
  on hareketler for all using (auth.role() = 'authenticated');

create policy "Authenticated full access - forecast"
  on forecast for all using (auth.role() = 'authenticated');

-- ── ÖRNEK VERİ (İsteğe bağlı, test için) ────────────────────
-- Bu satırları silmek isterseniz aşağısını yoruma alın

insert into chassis (id, chassis_no, plaka_no, tip) values
  ('CH-001', 'CHS-044', '34 ABC 044', '{"40FT"}'),
  ('CH-002', 'CHS-012', '34 DEF 012', '{"20FT"}'),
  ('CH-003', 'CHS-028', '34 GHJ 028', '{"45FT"}'),
  ('CH-004', 'CHS-007', '34 KLM 007', '{"20FT","40FT"}'),
  ('CH-005', 'CHS-019', '34 NOP 019', '{"40FT"}')
on conflict (id) do nothing;

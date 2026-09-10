-- =====================================================================
-- ServeGo — Marketplace de serviços (clientes x profissionais)
-- Arquivo: 01_schema.sql
-- Objetivo: extensões, enums, tabelas, índices, funções, triggers,
--           RPCs de negócio e configuração de Realtime.
-- Ordem de execução: 01_schema -> 02_rls -> 03_storage -> 04_seed
-- Idempotente: pode ser reexecutado no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensões
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid()
create extension if not exists "uuid-ossp" with schema extensions; -- reserva/compatibilidade

-- ---------------------------------------------------------------------
-- 1. Tipos enumerados
--    Criados dentro de blocos DO para não quebrar em reexecuções.
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('client','professional','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.urgency_level as enum ('now','today','tomorrow','scheduled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_status as enum ('open','matching','assigned','in_progress','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_status as enum ('pending','accepted','rejected','withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum ('accepted','on_the_way','arrived','in_progress','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.doc_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_status as enum ('pending','released','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('open','reviewing','resolved','dismissed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Função genérica de updated_at (usada por várias triggers)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger genérica: mantém a coluna updated_at sempre com o horário da última alteração.';

-- =====================================================================
-- 3. TABELAS
-- =====================================================================

-- 3.1 profiles — espelho público de auth.users -------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  city        text,
  state       text,                                  -- UF (SP, RJ, MG...)
  role        public.user_role   not null default 'client',
  status      public.user_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Perfil de todo usuário autenticado (cliente, profissional ou admin).';
comment on column public.profiles.state is 'Unidade federativa (sigla de 2 letras).';

-- 3.2 categories — catálogo de serviços --------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  icon        text,                                  -- emoji exibido no app
  description text,
  price_from  numeric(10,2),                         -- faixa de preço mínima (BRL)
  price_to    numeric(10,2),                         -- faixa de preço máxima (BRL)
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.categories is 'Categorias de serviço (eletricista, encanador, etc.).';

-- 3.3 professionals — dados profissionais (1:1 com profiles) -----------
create table if not exists public.professionals (
  id                  uuid primary key references public.profiles(id) on delete cascade,
  headline            text,                          -- chamada curta do perfil
  bio                 text,
  experience_years    int not null default 0,
  base_price          numeric(10,2),                 -- valor da visita/orçamento
  hourly_rate         numeric(10,2),
  service_radius_km   int not null default 10,
  lat                 double precision,
  lng                 double precision,
  city                text,
  state               text,
  is_available        boolean not null default false, -- "online" para receber chamados
  verified            boolean not null default false,
  verification_status public.verification_status not null default 'pending',
  rating              numeric(3,2) not null default 0,
  reviews_count       int not null default 0,
  jobs_count          int not null default 0,
  response_time_min   int not null default 15,
  completion_rate     numeric(5,2) not null default 100,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.professionals is 'Ficha do prestador de serviço; o id é o mesmo de profiles/auth.users.';

-- 3.4 professional_categories — N:N profissional x categoria -----------
create table if not exists public.professional_categories (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  category_id     uuid not null references public.categories(id)     on delete cascade,
  price_from      numeric(10,2),                     -- preço inicial daquele profissional nesta categoria
  primary key (professional_id, category_id)
);
comment on table public.professional_categories is 'Categorias atendidas por cada profissional, com preço inicial próprio.';

-- 3.5 service_requests — chamado aberto pelo cliente -------------------
create table if not exists public.service_requests (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.profiles(id)   on delete cascade,
  category_id        uuid references public.categories(id),
  title              text not null,
  description        text,
  address            text,
  address_complement text,
  lat                double precision,
  lng                double precision,
  urgency            public.urgency_level  not null default 'today',
  scheduled_for      timestamptz,                    -- preenchido quando urgency = 'scheduled'
  budget_hint        numeric(10,2),                  -- quanto o cliente pretende gastar
  status             public.request_status not null default 'open',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.service_requests is 'Solicitação de serviço criada pelo cliente.';

-- 3.6 service_photos — fotos do problema -------------------------------
create table if not exists public.service_photos (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.service_requests(id) on delete cascade,
  uploaded_by  uuid references public.profiles(id),
  storage_path text,                                 -- caminho no bucket service-photos
  url          text,                                 -- URL pública resolvida
  created_at   timestamptz not null default now()
);
comment on table public.service_photos is 'Fotos anexadas a uma solicitação de serviço.';

-- 3.7 service_offers — propostas dos profissionais ---------------------
create table if not exists public.service_offers (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.service_requests(id) on delete cascade,
  professional_id uuid not null references public.professionals(id)    on delete cascade,
  price           numeric(10,2) not null,
  message         text,
  eta_minutes     int,                               -- tempo estimado de chegada
  status          public.offer_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (request_id, professional_id)               -- uma oferta por profissional por chamado
);
comment on table public.service_offers is 'Oferta/orçamento enviado por um profissional para uma solicitação.';

-- 3.8 bookings — serviço contratado ------------------------------------
create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid unique not null references public.service_requests(id) on delete cascade,
  offer_id        uuid references public.service_offers(id),
  client_id       uuid references public.profiles(id),
  professional_id uuid references public.professionals(id),
  price           numeric(10,2) not null,
  status          public.booking_status not null default 'accepted',
  accepted_at     timestamptz not null default now(),
  started_at      timestamptz,
  arrived_at      timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.bookings is 'Contratação efetivada: um booking por solicitação aceita.';

-- 3.9 booking_events — linha do tempo do atendimento -------------------
create table if not exists public.booking_events (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status     public.booking_status not null,
  note       text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
comment on table public.booking_events is 'Histórico de mudanças de status de um booking (timeline do app).';

-- 3.10 messages — chat entre cliente e profissional --------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.service_requests(id) on delete cascade,
  booking_id   uuid references public.bookings(id) on delete set null,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content      text,
  image_url    text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
comment on table public.messages is 'Mensagens do chat, sempre vinculadas a uma solicitação.';

-- 3.11 reviews — avaliação do cliente ----------------------------------
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid unique not null references public.bookings(id) on delete cascade,
  request_id      uuid references public.service_requests(id),
  client_id       uuid references public.profiles(id),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  rating          int not null check (rating between 1 and 5),
  comment         text,
  tags            text[],                            -- ex.: {'pontual','caprichoso'}
  reply           text,                              -- resposta do profissional
  replied_at      timestamptz,
  created_at      timestamptz not null default now()
);
comment on table public.reviews is 'Avaliação de um serviço concluído (uma por booking).';

-- 3.12 notifications ---------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text,                                   -- offer_received, offer_accepted, message, ...
  title      text,
  body       text,
  link       text,                                   -- rota interna do app
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'Notificações in-app entregues via Realtime.';

-- 3.13 favorites -------------------------------------------------------
create table if not exists public.favorites (
  client_id       uuid not null references public.profiles(id)      on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (client_id, professional_id)
);
comment on table public.favorites is 'Profissionais favoritados por um cliente.';

-- 3.14 professional_documents — verificação/KYC ------------------------
create table if not exists public.professional_documents (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  doc_type        text,                              -- rg, cnh, comprovante_residencia, certificado
  storage_path    text,                              -- bucket privado professional-documents
  status          public.doc_status not null default 'pending',
  reviewed_by     uuid references public.profiles(id),
  reviewed_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);
comment on table public.professional_documents is 'Documentos enviados pelo profissional para verificação (bucket privado).';

-- 3.15 transactions — financeiro ---------------------------------------
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  professional_id uuid references public.professionals(id),
  client_id       uuid references public.profiles(id),
  amount          numeric(10,2) not null,            -- valor bruto pago pelo cliente
  platform_fee    numeric(10,2) not null default 0,  -- comissão da plataforma (10%)
  net_amount      numeric(10,2) not null default 0,  -- repasse líquido ao profissional
  status          public.transaction_status not null default 'pending',
  created_at      timestamptz not null default now()
);
comment on table public.transactions is 'Lançamento financeiro gerado quando um booking é concluído.';

-- 3.16 reports — denúncias ---------------------------------------------
create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  booking_id     uuid references public.bookings(id),
  reason         text,
  description    text,
  status         public.report_status not null default 'open',
  resolved_by    uuid references public.profiles(id),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
comment on table public.reports is 'Denúncias abertas por usuários e tratadas pelo admin.';

-- =====================================================================
-- 4. ÍNDICES
--    Cobrem as FKs usadas em filtro e as consultas mais quentes do app.
-- =====================================================================
create index if not exists idx_profiles_role                on public.profiles (role);
create index if not exists idx_profiles_email               on public.profiles (email);

create index if not exists idx_categories_active_sort       on public.categories (active, sort_order);

create index if not exists idx_professionals_available      on public.professionals (is_available, verification_status);
create index if not exists idx_professionals_city_state     on public.professionals (state, city);
create index if not exists idx_professionals_rating         on public.professionals (rating desc);

create index if not exists idx_prof_categories_category     on public.professional_categories (category_id);
create index if not exists idx_prof_categories_professional on public.professional_categories (professional_id);

create index if not exists idx_requests_client              on public.service_requests (client_id);
create index if not exists idx_requests_category            on public.service_requests (category_id);
create index if not exists idx_requests_status_created      on public.service_requests (status, created_at desc);

create index if not exists idx_photos_request               on public.service_photos (request_id);

create index if not exists idx_offers_request_status        on public.service_offers (request_id, status);
create index if not exists idx_offers_professional          on public.service_offers (professional_id, status);

create index if not exists idx_bookings_professional_status on public.bookings (professional_id, status);
create index if not exists idx_bookings_client_status       on public.bookings (client_id, status);
create index if not exists idx_bookings_request             on public.bookings (request_id);

create index if not exists idx_booking_events_booking       on public.booking_events (booking_id, created_at desc);

create index if not exists idx_messages_request_created     on public.messages (request_id, created_at);
create index if not exists idx_messages_recipient_read      on public.messages (recipient_id, read_at);
create index if not exists idx_messages_sender              on public.messages (sender_id);

create index if not exists idx_reviews_professional         on public.reviews (professional_id);
create index if not exists idx_reviews_client               on public.reviews (client_id);

create index if not exists idx_notifications_user_read      on public.notifications (user_id, read_at);

create index if not exists idx_favorites_professional       on public.favorites (professional_id);

create index if not exists idx_prof_docs_professional       on public.professional_documents (professional_id, status);

create index if not exists idx_transactions_professional    on public.transactions (professional_id, status);
create index if not exists idx_transactions_client          on public.transactions (client_id);
create index if not exists idx_transactions_booking         on public.transactions (booking_id);
create index if not exists idx_transactions_created         on public.transactions (created_at desc);

create index if not exists idx_reports_reporter             on public.reports (reporter_id);
create index if not exists idx_reports_status               on public.reports (status);

-- =====================================================================
-- 5. FUNÇÕES AUXILIARES DE SEGURANÇA
--    SECURITY DEFINER para que as policies não voltem a consultar
--    tabelas protegidas por RLS (evita recursão infinita).
-- =====================================================================

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;
comment on function public.is_admin(uuid) is
  'Retorna true se o usuário informado (default: auth.uid()) é admin. Usada nas policies.';

create or replace function public.is_booking_participant(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    -- é o cliente dono da solicitação
    select 1 from public.service_requests sr
    where sr.id = p_request_id and sr.client_id = auth.uid()
  )
  or exists (
    -- é o profissional com oferta aceita naquela solicitação
    select 1 from public.service_offers so
    where so.request_id = p_request_id
      and so.professional_id = auth.uid()
      and so.status = 'accepted'
  )
  or exists (
    -- é o profissional do booking daquela solicitação
    select 1 from public.bookings b
    where b.request_id = p_request_id
      and (b.professional_id = auth.uid() or b.client_id = auth.uid())
  );
$$;
comment on function public.is_booking_participant(uuid) is
  'True se auth.uid() participa da solicitação: cliente dono, profissional com oferta aceita ou profissional do booking.';

-- Usada nas policies de service_requests. Precisa ser SECURITY DEFINER:
-- se a policy de service_requests consultasse service_offers diretamente,
-- e a policy de service_offers consulta service_requests, o Postgres
-- acusaria "infinite recursion detected in policy for relation" (42P17).
create or replace function public.has_request_link(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.service_offers so
    where so.request_id = p_request_id and so.professional_id = auth.uid()
  )
  or exists (
    select 1 from public.bookings b
    where b.request_id = p_request_id and b.professional_id = auth.uid()
  );
$$;
comment on function public.has_request_link(uuid) is
  'True se auth.uid() é um profissional vinculado à solicitação (enviou oferta ou é o profissional do booking).';

create or replace function public.is_request_booking_pro(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings b
    where b.request_id = p_request_id and b.professional_id = auth.uid()
  );
$$;
comment on function public.is_request_booking_pro(uuid) is
  'True se auth.uid() é o profissional contratado no booking daquela solicitação.';

-- =====================================================================
-- 6. CRIAÇÃO AUTOMÁTICA DE PERFIL AO CADASTRAR NO AUTH
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  -- role vem do metadata do signup; qualquer valor inválido cai em 'client'
  begin
    v_role := coalesce(nullif(new.raw_user_meta_data->>'role',''), 'client')::public.user_role;
  exception when others then
    v_role := 'client';
  end;

  insert into public.profiles (id, full_name, email, phone, avatar_url, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'full_name',''),
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'phone',''), new.phone),
    nullif(new.raw_user_meta_data->>'avatar_url',''),
    v_role
  )
  on conflict (id) do nothing;

  -- profissional ganha automaticamente a ficha em professionals
  if v_role = 'professional' then
    insert into public.professionals (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
comment on function public.handle_new_user() is
  'Cria o profile (e a ficha de professionals quando role = professional) logo após o signup em auth.users.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 7. NOTIFICAÇÕES
-- =====================================================================
create or replace function public.notify(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text default null,
  p_link    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link)
  returning id into v_id;

  return v_id;
end;
$$;
comment on function public.notify(uuid, text, text, text, text) is
  'Helper para inserir notificações a partir de triggers, ignorando RLS.';

-- 7.1 Nova oferta recebida -> notifica o cliente -----------------------
create or replace function public.notify_new_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_title     text;
  v_pro_name  text;
begin
  select sr.client_id, sr.title into v_client_id, v_title
  from public.service_requests sr where sr.id = new.request_id;

  select p.full_name into v_pro_name
  from public.profiles p where p.id = new.professional_id;

  perform public.notify(
    v_client_id,
    'offer_received',
    'Você recebeu uma nova oferta',
    coalesce(v_pro_name,'Um profissional') || ' ofereceu R$ ' ||
      to_char(new.price, 'FM999G999D00') || ' para "' || coalesce(v_title,'seu chamado') || '".',
    '/solicitacoes/' || new.request_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_offers_notify_new on public.service_offers;
create trigger trg_offers_notify_new
  after insert on public.service_offers
  for each row execute function public.notify_new_offer();

-- 7.2 Oferta aceita -> notifica o profissional -------------------------
create or replace function public.notify_offer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.notify(
      new.professional_id,
      'offer_accepted',
      'Sua oferta foi aceita!',
      'O cliente aceitou sua proposta de R$ ' || to_char(new.price, 'FM999G999D00') || '. Combine os detalhes pelo chat.',
      '/servicos/' || new.request_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_offers_notify_accepted on public.service_offers;
create trigger trg_offers_notify_accepted
  after update of status on public.service_offers
  for each row execute function public.notify_offer_accepted();

-- 7.3 Nova mensagem -> notifica o destinatário -------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender text;
begin
  select p.full_name into v_sender from public.profiles p where p.id = new.sender_id;

  perform public.notify(
    new.recipient_id,
    'message',
    coalesce(v_sender,'Nova mensagem'),
    left(coalesce(new.content, '📷 Enviou uma imagem'), 120),
    '/chat/' || new.request_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_messages_notify on public.messages;
create trigger trg_messages_notify
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- 7.4 Nova avaliação -> notifica o profissional ------------------------
create or replace function public.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify(
    new.professional_id,
    'review_received',
    'Você recebeu uma avaliação',
    'Nota ' || new.rating || ' estrela(s)' ||
      case when new.comment is not null then ': "' || left(new.comment, 100) || '"' else '.' end,
    '/perfil/avaliacoes'
  );
  return new;
end;
$$;

drop trigger if exists trg_reviews_notify on public.reviews;
create trigger trg_reviews_notify
  after insert on public.reviews
  for each row execute function public.notify_new_review();

-- =====================================================================
-- 8. REGRAS DE NEGÓCIO (triggers)
-- =====================================================================

-- 8.1 Recalcula rating e reviews_count do profissional -----------------
create or replace function public.refresh_professional_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional_id uuid;
begin
  v_professional_id := coalesce(new.professional_id, old.professional_id);

  update public.professionals p
  set rating = coalesce(agg.avg_rating, 0),
      reviews_count = coalesce(agg.total, 0),
      updated_at = now()
  from (
    select round(avg(r.rating)::numeric, 2) as avg_rating, count(*) as total
    from public.reviews r
    where r.professional_id = v_professional_id
  ) agg
  where p.id = v_professional_id;

  return coalesce(new, old);
end;
$$;
comment on function public.refresh_professional_rating() is
  'Recalcula média de notas e total de avaliações do profissional a cada insert/update/delete em reviews.';

drop trigger if exists trg_reviews_refresh_rating on public.reviews;
create trigger trg_reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_professional_rating();

-- 8.2 Ciclo de vida do booking ----------------------------------------
--     Roda BEFORE UPDATE para poder carimbar os timestamps em NEW e,
--     na transição para 'completed', dispara os efeitos colaterais.
create or replace function public.on_booking_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric(10,2);
  v_net numeric(10,2);
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- carimba o timestamp correspondente ao novo status
  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  elsif new.status = 'arrived' and new.arrived_at is null then
    new.arrived_at := now();
  elsif new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());

    -- contador de serviços realizados
    update public.professionals
    set jobs_count = jobs_count + 1,
        updated_at = now()
    where id = new.professional_id;

    -- fecha a solicitação
    update public.service_requests
    set status = 'completed',
        updated_at = now()
    where id = new.request_id;

    -- lançamento financeiro: comissão fixa de 10% da plataforma
    v_fee := round(coalesce(new.price, 0) * 0.10, 2);
    v_net := round(coalesce(new.price, 0) - v_fee, 2);

    insert into public.transactions (booking_id, professional_id, client_id, amount, platform_fee, net_amount, status)
    values (new.id, new.professional_id, new.client_id, coalesce(new.price, 0), v_fee, v_net, 'pending');

    -- avisa o cliente para avaliar
    perform public.notify(
      new.client_id,
      'booking_completed',
      'Serviço concluído',
      'O profissional finalizou o atendimento. Que tal avaliar o serviço?',
      '/avaliar/' || new.id::text
    );
  end if;

  return new;
end;
$$;
comment on function public.on_booking_completed() is
  'Carimba timestamps do booking e, ao concluir, incrementa jobs_count, fecha a solicitação, gera a transação (10% de taxa) e notifica o cliente.';

drop trigger if exists trg_bookings_lifecycle on public.bookings;
create trigger trg_bookings_lifecycle
  before update on public.bookings
  for each row execute function public.on_booking_completed();

-- 8.3 Timeline do booking ---------------------------------------------
create or replace function public.log_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deve_registrar boolean := false;
begin
  -- OLD não existe em trigger de INSERT: testar tg_op primeiro, em ramos
  -- separados, evita o erro "record old is not assigned yet".
  if tg_op = 'INSERT' then
    v_deve_registrar := true;
  elsif new.status is distinct from old.status then
    v_deve_registrar := true;
  end if;

  if v_deve_registrar then
    insert into public.booking_events (booking_id, status, note, created_by)
    values (
      new.id,
      new.status,
      case when new.status = 'cancelled' then new.cancel_reason else null end,
      auth.uid()
    );
  end if;

  return new;
end;
$$;
comment on function public.log_booking_event() is 'Registra em booking_events cada mudança de status do booking.';

drop trigger if exists trg_bookings_log_insert on public.bookings;
create trigger trg_bookings_log_insert
  after insert on public.bookings
  for each row execute function public.log_booking_event();

drop trigger if exists trg_bookings_log_update on public.bookings;
create trigger trg_bookings_log_update
  after update of status on public.bookings
  for each row execute function public.log_booking_event();

-- =====================================================================
-- 9. TRIGGERS DE updated_at
-- =====================================================================
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_professionals_updated_at on public.professionals;
create trigger trg_professionals_updated_at before update on public.professionals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_requests_updated_at on public.service_requests;
create trigger trg_requests_updated_at before update on public.service_requests
  for each row execute function public.set_updated_at();

drop trigger if exists trg_offers_updated_at on public.service_offers;
create trigger trg_offers_updated_at before update on public.service_offers
  for each row execute function public.set_updated_at();

-- Em bookings o updated_at roda depois do lifecycle (nome alfabético maior
-- não importa: ambos são BEFORE UPDATE e a ordem é por nome do trigger).
drop trigger if exists trg_bookings_zz_updated_at on public.bookings;
create trigger trg_bookings_zz_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 10. RPCs CONSUMIDAS PELO FRONT-END
-- =====================================================================

-- 10.1 Busca de profissionais por categoria + proximidade --------------
--      Distância calculada por Haversine (raio da Terra = 6371 km).
create or replace function public.search_professionals(
  p_category_id uuid,
  p_lat         double precision,
  p_lng         double precision,
  p_radius_km   int default 25,
  p_limit       int default 20
)
returns table (
  id               uuid,
  full_name        text,
  avatar_url       text,
  headline         text,
  rating           numeric,
  reviews_count    int,
  jobs_count       int,
  experience_years int,
  base_price       numeric,
  price_from       numeric,
  distance_km      double precision,
  eta_minutes      int,
  verified         boolean,
  city             text,
  state            text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pro.id,
    prof.full_name,
    prof.avatar_url,
    pro.headline,
    pro.rating,
    pro.reviews_count,
    pro.jobs_count,
    pro.experience_years,
    pro.base_price,
    coalesce(pc.price_from, pro.base_price)              as price_from,
    d.distance_km,
    case
      when d.distance_km is null then pro.response_time_min
      else round(8 + d.distance_km * 3)::int
    end                                                  as eta_minutes,
    pro.verified,
    pro.city,
    pro.state
  from public.professionals pro
  join public.profiles prof
    on prof.id = pro.id
  join public.professional_categories pc
    on pc.professional_id = pro.id
   and pc.category_id = p_category_id
  cross join lateral (
    select case
      when p_lat is null or p_lng is null or pro.lat is null or pro.lng is null then null::double precision
      else 6371 * acos(
        least(1, greatest(-1,
          cos(radians(p_lat)) * cos(radians(pro.lat)) * cos(radians(pro.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(pro.lat))
        ))
      )
    end as distance_km
  ) d
  where prof.status = 'active'
    and pro.is_available = true
    and (pro.verified = true or pro.verification_status = 'approved')
    -- sem coordenadas de um dos lados, não filtramos por raio
    and (d.distance_km is null or d.distance_km <= coalesce(p_radius_km, 25))
  order by pro.rating desc, d.distance_km asc nulls last, pro.jobs_count desc
  limit coalesce(p_limit, 20);
$$;
comment on function public.search_professionals(uuid, double precision, double precision, int, int) is
  'Lista profissionais disponíveis e verificados de uma categoria, ordenados por nota e proximidade (Haversine).';

-- 10.2 Métricas do painel administrativo -------------------------------
create or replace function public.admin_metrics()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: somente administradores podem consultar as métricas.'
      using errcode = '42501';
  end if;

  select json_build_object(
    'total_usuarios',           (select count(*) from public.profiles),
    'total_clientes',           (select count(*) from public.profiles where role = 'client'),
    'total_profissionais',      (select count(*) from public.professionals),
    'profissionais_pendentes',  (select count(*) from public.professionals where verification_status = 'pending'),
    'total_solicitacoes',       (select count(*) from public.service_requests),
    'solicitacoes_abertas',     (select count(*) from public.service_requests where status in ('open','matching')),
    'servicos_concluidos',      (select count(*) from public.bookings where status = 'completed'),
    -- faturamento: volume transacionado e a comissão já liberada à plataforma
    'volume_transacionado',     (select coalesce(sum(amount), 0)       from public.transactions where status <> 'refunded'),
    'receita_plataforma',       (select coalesce(sum(platform_fee), 0) from public.transactions where status = 'released'),
    'receita_prevista',         (select coalesce(sum(platform_fee), 0) from public.transactions where status = 'pending'),
    'taxa_conclusao',           (
      select case when count(*) = 0 then 0
             else round(100.0 * count(*) filter (where status = 'completed') / count(*), 2)
             end
      from public.bookings
    ),
    'gerado_em', now()
  ) into v_result;

  return v_result;
end;
$$;
comment on function public.admin_metrics() is 'Indicadores agregados do marketplace. Restrito a administradores.';

-- 10.3 Ganhos do profissional ------------------------------------------
create or replace function public.professional_earnings(
  p_professional_id uuid default auth.uid()
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  -- só o próprio profissional ou um admin
  if p_professional_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Acesso negado: você só pode consultar os seus próprios ganhos.'
      using errcode = '42501';
  end if;

  select json_build_object(
    'hoje',   (select coalesce(sum(net_amount),0) from public.transactions
                where professional_id = p_professional_id and status <> 'refunded'
                  and created_at >= date_trunc('day', now())),
    'semana', (select coalesce(sum(net_amount),0) from public.transactions
                where professional_id = p_professional_id and status <> 'refunded'
                  and created_at >= date_trunc('week', now())),
    'mes',    (select coalesce(sum(net_amount),0) from public.transactions
                where professional_id = p_professional_id and status <> 'refunded'
                  and created_at >= date_trunc('month', now())),
    'total',  (select coalesce(sum(net_amount),0) from public.transactions
                where professional_id = p_professional_id and status <> 'refunded'),
    'a_receber', (select coalesce(sum(net_amount),0) from public.transactions
                where professional_id = p_professional_id and status = 'pending'),
    'servicos_concluidos', (select count(*) from public.bookings
                where professional_id = p_professional_id and status = 'completed'),
    'ultimos_7_dias', (
      select coalesce(json_agg(json_build_object('dia', dia, 'valor', valor) order by dia), '[]'::json)
      from (
        select d::date as dia,
               coalesce((
                 select sum(t.net_amount) from public.transactions t
                 where t.professional_id = p_professional_id
                   and t.status <> 'refunded'
                   and t.created_at >= d
                   and t.created_at <  d + interval '1 day'
               ), 0) as valor
        from generate_series(date_trunc('day', now()) - interval '6 days',
                             date_trunc('day', now()),
                             interval '1 day') as d
      ) serie
    )
  ) into v_result;

  return v_result;
end;
$$;
comment on function public.professional_earnings(uuid) is
  'Resumo de ganhos do profissional (hoje/semana/mês/total) e série dos últimos 7 dias.';

-- =====================================================================
-- 11. REALTIME
--     O bloco DO evita erro caso a tabela já esteja na publication.
-- =====================================================================
do $$
declare
  t text;
begin
  foreach t in array array['messages','service_offers','bookings','notifications'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- já está na publication
      when undefined_object then null;   -- publication não existe neste ambiente
      when others then null;
    end;
  end loop;
end $$;

-- =====================================================================
-- 12. GRANTS de execução das RPCs
-- =====================================================================
grant execute on function public.search_professionals(uuid, double precision, double precision, int, int) to anon, authenticated;
grant execute on function public.admin_metrics()                     to authenticated;
grant execute on function public.professional_earnings(uuid)         to authenticated;
grant execute on function public.is_admin(uuid)                      to authenticated;
grant execute on function public.is_booking_participant(uuid)        to authenticated;
grant execute on function public.has_request_link(uuid)              to authenticated;
grant execute on function public.is_request_booking_pro(uuid)        to authenticated;

-- Fim do 01_schema.sql

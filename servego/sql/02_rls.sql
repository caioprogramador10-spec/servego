-- =====================================================================
-- ServeGo — Marketplace de serviços
-- Arquivo: 02_rls.sql
-- Objetivo: habilitar Row Level Security em todas as tabelas do schema
--           public e declarar as policies de leitura/escrita.
-- Requisitos: 01_schema.sql já executado (usa is_admin() e
--             is_booking_participant(), ambas SECURITY DEFINER).
-- Idempotente: todo policy é derrubado com DROP POLICY IF EXISTS antes.
--
-- REGRA DE OURO: nenhuma policy pode consultar a própria tabela que ela
-- protege sem passar por uma função SECURITY DEFINER — caso contrário o
-- Postgres entra em recursão infinita de RLS (erro 42P17).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Habilitar RLS em todas as tabelas
-- ---------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.categories              enable row level security;
alter table public.professionals           enable row level security;
alter table public.professional_categories enable row level security;
alter table public.service_requests        enable row level security;
alter table public.service_photos          enable row level security;
alter table public.service_offers          enable row level security;
alter table public.bookings                enable row level security;
alter table public.booking_events          enable row level security;
alter table public.messages                enable row level security;
alter table public.reviews                 enable row level security;
alter table public.notifications           enable row level security;
alter table public.favorites               enable row level security;
alter table public.professional_documents  enable row level security;
alter table public.transactions            enable row level security;
alter table public.reports                 enable row level security;

-- =====================================================================
-- 2. profiles
-- =====================================================================
drop policy if exists "profiles_select_own"          on public.profiles;
drop policy if exists "profiles_select_professional" on public.profiles;
drop policy if exists "profiles_insert_own"          on public.profiles;
drop policy if exists "profiles_update_own"          on public.profiles;
drop policy if exists "profiles_admin_all"           on public.profiles;

-- Cada usuário enxerga o próprio perfil por completo.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Vitrine: o perfil de quem é profissional é visível para qualquer um.
-- LIMITAÇÃO CONHECIDA: o RLS trabalha por linha, não por coluna. Logo,
-- colunas sensíveis (email, phone) desta linha também ficam legíveis.
-- Por isso o front-end DEVE selecionar apenas full_name/avatar_url/city/
-- state ao listar profissionais. Para blindar de verdade, crie uma VIEW
-- pública com as colunas permitidas e revogue o select direto na tabela.
create policy "profiles_select_professional"
  on public.profiles for select
  to anon, authenticated
  using (role = 'professional');

-- O trigger handle_new_user já cria a linha; este insert cobre o caso de
-- criação manual do próprio perfil pelo client SDK.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admin: acesso total (is_admin é SECURITY DEFINER, não recursa).
create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 3. categories — catálogo público, escrita só do admin
-- =====================================================================
drop policy if exists "categories_select_all" on public.categories;
drop policy if exists "categories_admin_all"  on public.categories;

create policy "categories_select_all"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "categories_admin_all"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 4. professionals — o perfil profissional é vitrine pública
-- =====================================================================
drop policy if exists "professionals_select_all"  on public.professionals;
drop policy if exists "professionals_insert_own"  on public.professionals;
drop policy if exists "professionals_update_own"  on public.professionals;
drop policy if exists "professionals_admin_all"   on public.professionals;

create policy "professionals_select_all"
  on public.professionals for select
  to anon, authenticated
  using (true);

create policy "professionals_insert_own"
  on public.professionals for insert
  to authenticated
  with check (id = auth.uid());

-- Observação: campos como verified/verification_status ficam editáveis pelo
-- próprio profissional no nível de RLS. Bloqueie-os por GRANT de coluna ou
-- por trigger caso queira que só o admin altere a verificação.
create policy "professionals_update_own"
  on public.professionals for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "professionals_admin_all"
  on public.professionals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 5. professional_categories — leitura pública, escrita só do dono
-- =====================================================================
drop policy if exists "prof_categories_select_all" on public.professional_categories;
drop policy if exists "prof_categories_write_own"  on public.professional_categories;
drop policy if exists "prof_categories_admin_all"  on public.professional_categories;

create policy "prof_categories_select_all"
  on public.professional_categories for select
  to anon, authenticated
  using (true);

create policy "prof_categories_write_own"
  on public.professional_categories for all
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "prof_categories_admin_all"
  on public.professional_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 6. service_requests
--    Cliente: dono absoluto. Profissional: vê o que está aberto (para
--    ofertar) e o que já é dele (tem oferta ou booking).
-- =====================================================================
drop policy if exists "requests_select_own_client"    on public.service_requests;
drop policy if exists "requests_select_open_for_pros" on public.service_requests;
drop policy if exists "requests_select_involved_pro"  on public.service_requests;
drop policy if exists "requests_insert_own_client"    on public.service_requests;
drop policy if exists "requests_update_own_client"    on public.service_requests;
drop policy if exists "requests_delete_own_client"    on public.service_requests;
drop policy if exists "requests_update_involved_pro"  on public.service_requests;
drop policy if exists "requests_admin_all"            on public.service_requests;

create policy "requests_select_own_client"
  on public.service_requests for select
  to authenticated
  using (client_id = auth.uid());

-- Feed de oportunidades: qualquer profissional cadastrado vê chamados
-- ainda sem contratação para poder enviar uma oferta.
create policy "requests_select_open_for_pros"
  on public.service_requests for select
  to authenticated
  using (
    status in ('open','matching')
    and exists (select 1 from public.professionals pr where pr.id = auth.uid())
  );

-- Depois de fechado, o profissional continua vendo os chamados em que
-- participa (tem oferta enviada ou é o profissional do booking).
-- IMPORTANTE: usa has_request_link() (SECURITY DEFINER) em vez de um
-- EXISTS direto em service_offers. As policies de service_offers já
-- consultam service_requests; um EXISTS aqui fecharia o ciclo e o Postgres
-- abortaria com "infinite recursion detected in policy" (42P17).
create policy "requests_select_involved_pro"
  on public.service_requests for select
  to authenticated
  using (public.has_request_link(id));

create policy "requests_insert_own_client"
  on public.service_requests for insert
  to authenticated
  with check (client_id = auth.uid());

create policy "requests_update_own_client"
  on public.service_requests for update
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy "requests_delete_own_client"
  on public.service_requests for delete
  to authenticated
  using (client_id = auth.uid());

-- O profissional do booking pode mover o status do chamado (in_progress etc.).
-- Também via função SECURITY DEFINER, pelo mesmo motivo do bloco acima.
create policy "requests_update_involved_pro"
  on public.service_requests for update
  to authenticated
  using (public.is_request_booking_pro(id))
  with check (public.is_request_booking_pro(id));

create policy "requests_admin_all"
  on public.service_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 7. service_photos — segue a visibilidade da solicitação
-- =====================================================================
drop policy if exists "photos_select_participants" on public.service_photos;
drop policy if exists "photos_insert_owner"        on public.service_photos;
drop policy if exists "photos_delete_owner"        on public.service_photos;
drop policy if exists "photos_admin_all"           on public.service_photos;

-- Quem consegue ler o request (RLS do item 6) consegue ler as fotos.
create policy "photos_select_participants"
  on public.service_photos for select
  to authenticated
  using (
    exists (select 1 from public.service_requests sr where sr.id = service_photos.request_id)
  );

-- Só o cliente dono da solicitação anexa fotos, e sempre em seu nome.
create policy "photos_insert_owner"
  on public.service_photos for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_photos.request_id and sr.client_id = auth.uid()
    )
  );

create policy "photos_delete_owner"
  on public.service_photos for delete
  to authenticated
  using (uploaded_by = auth.uid());

create policy "photos_admin_all"
  on public.service_photos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 8. service_offers
--    Profissional gerencia as suas; cliente vê e decide as que recebeu.
-- =====================================================================
drop policy if exists "offers_select_own_pro"      on public.service_offers;
drop policy if exists "offers_select_own_client"   on public.service_offers;
drop policy if exists "offers_insert_own_pro"      on public.service_offers;
drop policy if exists "offers_update_own_pro"      on public.service_offers;
drop policy if exists "offers_delete_own_pro"      on public.service_offers;
drop policy if exists "offers_update_client_decision" on public.service_offers;
drop policy if exists "offers_admin_all"           on public.service_offers;

create policy "offers_select_own_pro"
  on public.service_offers for select
  to authenticated
  using (professional_id = auth.uid());

create policy "offers_select_own_client"
  on public.service_offers for select
  to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_offers.request_id and sr.client_id = auth.uid()
    )
  );

-- O profissional só oferta em chamados ainda disponíveis.
create policy "offers_insert_own_pro"
  on public.service_offers for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = service_offers.request_id
        and sr.status in ('open','matching')
    )
  );

create policy "offers_update_own_pro"
  on public.service_offers for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "offers_delete_own_pro"
  on public.service_offers for delete
  to authenticated
  using (professional_id = auth.uid());

-- Cliente aceita/recusa: pode atualizar as ofertas dos seus chamados.
create policy "offers_update_client_decision"
  on public.service_offers for update
  to authenticated
  using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_offers.request_id and sr.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.service_requests sr
      where sr.id = service_offers.request_id and sr.client_id = auth.uid()
    )
  );

create policy "offers_admin_all"
  on public.service_offers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 9. bookings — apenas as duas partes envolvidas
-- =====================================================================
drop policy if exists "bookings_select_participants" on public.bookings;
drop policy if exists "bookings_insert_client"       on public.bookings;
drop policy if exists "bookings_update_participants" on public.bookings;
drop policy if exists "bookings_admin_all"           on public.bookings;

create policy "bookings_select_participants"
  on public.bookings for select
  to authenticated
  using (client_id = auth.uid() or professional_id = auth.uid());

-- O booking nasce quando o cliente aceita uma oferta.
create policy "bookings_insert_client"
  on public.bookings for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = bookings.request_id and sr.client_id = auth.uid()
    )
  );

-- Ambos avançam o status (a caminho, cheguei, iniciei, concluí, cancelei).
create policy "bookings_update_participants"
  on public.bookings for update
  to authenticated
  using (client_id = auth.uid() or professional_id = auth.uid())
  with check (client_id = auth.uid() or professional_id = auth.uid());

create policy "bookings_admin_all"
  on public.bookings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 10. booking_events — timeline visível aos participantes
-- =====================================================================
drop policy if exists "booking_events_select_participants" on public.booking_events;
drop policy if exists "booking_events_insert_participants" on public.booking_events;
drop policy if exists "booking_events_admin_all"           on public.booking_events;

create policy "booking_events_select_participants"
  on public.booking_events for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_events.booking_id
        and (b.client_id = auth.uid() or b.professional_id = auth.uid())
    )
  );

create policy "booking_events_insert_participants"
  on public.booking_events for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_events.booking_id
        and (b.client_id = auth.uid() or b.professional_id = auth.uid())
    )
  );

create policy "booking_events_admin_all"
  on public.booking_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 11. messages — conversa privada entre as duas pontas
-- =====================================================================
drop policy if exists "messages_select_parties"     on public.messages;
drop policy if exists "messages_insert_sender"      on public.messages;
drop policy if exists "messages_update_recipient"   on public.messages;
drop policy if exists "messages_admin_all"          on public.messages;

create policy "messages_select_parties"
  on public.messages for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Só envia em nome próprio e só dentro de um chamado do qual participa.
create policy "messages_insert_sender"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_booking_participant(request_id)
  );

-- O destinatário só marca como lida (read_at); não edita o conteúdo alheio.
create policy "messages_update_recipient"
  on public.messages for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "messages_admin_all"
  on public.messages for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 12. reviews — reputação é pública
-- =====================================================================
drop policy if exists "reviews_select_all"       on public.reviews;
drop policy if exists "reviews_insert_client"    on public.reviews;
drop policy if exists "reviews_update_client"    on public.reviews;
drop policy if exists "reviews_update_pro_reply" on public.reviews;
drop policy if exists "reviews_admin_all"        on public.reviews;

create policy "reviews_select_all"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Só o cliente do booking, e só depois do serviço concluído.
create policy "reviews_insert_client"
  on public.reviews for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = reviews.booking_id
        and b.client_id = auth.uid()
        and b.status = 'completed'
    )
  );

-- Cliente edita a própria avaliação (nota/comentário/tags).
create policy "reviews_update_client"
  on public.reviews for update
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- Profissional responde à avaliação. LIMITAÇÃO: o RLS não restringe por
-- coluna — para garantir que ele só altere reply/replied_at, use um GRANT
-- de UPDATE(reply, replied_at) para o role authenticated ou uma trigger
-- BEFORE UPDATE que rejeite alterações nos demais campos.
create policy "reviews_update_pro_reply"
  on public.reviews for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "reviews_admin_all"
  on public.reviews for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 13. notifications — estritamente do dono
-- =====================================================================
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
drop policy if exists "notifications_admin_all"  on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Marcar como lida.
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- Não há policy de INSERT: notificações só são criadas pela função
-- public.notify() (SECURITY DEFINER), nunca direto pelo client SDK.

create policy "notifications_admin_all"
  on public.notifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 14. favorites — lista privada do cliente
-- =====================================================================
drop policy if exists "favorites_all_own" on public.favorites;

create policy "favorites_all_own"
  on public.favorites for all
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- =====================================================================
-- 15. professional_documents — dono + admin (dados sensíveis)
-- =====================================================================
drop policy if exists "prof_docs_select_own"  on public.professional_documents;
drop policy if exists "prof_docs_insert_own"  on public.professional_documents;
drop policy if exists "prof_docs_delete_own"  on public.professional_documents;
drop policy if exists "prof_docs_admin_all"   on public.professional_documents;

create policy "prof_docs_select_own"
  on public.professional_documents for select
  to authenticated
  using (professional_id = auth.uid());

create policy "prof_docs_insert_own"
  on public.professional_documents for insert
  to authenticated
  with check (professional_id = auth.uid());

-- Enquanto pendente, o profissional pode remover e reenviar o documento.
create policy "prof_docs_delete_own"
  on public.professional_documents for delete
  to authenticated
  using (professional_id = auth.uid() and status = 'pending');

-- Só o admin aprova/reprova.
create policy "prof_docs_admin_all"
  on public.professional_documents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 16. transactions — leitura para as partes, escrita só do sistema/admin
-- =====================================================================
drop policy if exists "transactions_select_parties" on public.transactions;
drop policy if exists "transactions_admin_all"      on public.transactions;

create policy "transactions_select_parties"
  on public.transactions for select
  to authenticated
  using (client_id = auth.uid() or professional_id = auth.uid());

-- Não há INSERT/UPDATE para usuários: as transações nascem da trigger
-- public.on_booking_completed() (SECURITY DEFINER).
create policy "transactions_admin_all"
  on public.transactions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- 17. reports — o denunciante vê o que abriu; o admin trata tudo
-- =====================================================================
drop policy if exists "reports_select_own"    on public.reports;
drop policy if exists "reports_insert_own"    on public.reports;
drop policy if exists "reports_admin_all"     on public.reports;

create policy "reports_select_own"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "reports_admin_all"
  on public.reports for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Fim do 02_rls.sql

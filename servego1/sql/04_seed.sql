-- =====================================================================
-- ServeGo — Marketplace de serviços
-- Arquivo: 04_seed.sql
-- Objetivo: popular o catálogo de categorias e documentar como criar os
--           usuários de teste (Auth) e promover um deles a administrador.
-- Idempotente: o insert usa ON CONFLICT (slug) DO UPDATE, então rodar de
--              novo apenas atualiza nome, ícone, faixa de preço e ordem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catálogo de categorias
--    Faixas de preço em BRL, referência de mercado para serviço avulso.
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, icon, description, price_from, price_to, sort_order, active)
values
  ('eletricista', 'Eletricista', '⚡',
   'Instalação e reparo de tomadas, chuveiros, disjuntores, luminárias e quadros de energia.',
   80.00, 450.00, 1, true),

  ('encanador', 'Encanador', '💧',
   'Vazamentos, desentupimento, troca de torneiras, caixas d''água e reparos hidráulicos.',
   90.00, 500.00, 2, true),

  ('mecanico', 'Mecânico', '🔧',
   'Socorro em via, troca de bateria e pneu, revisão, freios e diagnóstico eletrônico.',
   120.00, 800.00, 3, true),

  ('pintor', 'Pintor', '🎨',
   'Pintura de paredes, tetos, fachadas e grades, com massa corrida e textura.',
   150.00, 1200.00, 4, true),

  ('pedreiro', 'Pedreiro', '🧱',
   'Alvenaria, reboco, assentamento de piso e azulejo, pequenas reformas e acabamento.',
   180.00, 1500.00, 5, true),

  ('ar-condicionado', 'Ar-condicionado', '❄️',
   'Instalação, higienização, recarga de gás e manutenção de split e janela.',
   120.00, 600.00, 6, true),

  ('montador-moveis', 'Montador de Móveis', '🪑',
   'Montagem e desmontagem de guarda-roupa, cozinha planejada, cama e estantes.',
   80.00, 400.00, 7, true),

  ('jardinagem', 'Jardinagem', '🌳',
   'Corte de grama, poda de árvores e arbustos, paisagismo e limpeza de quintal.',
   90.00, 450.00, 8, true),

  ('informatica', 'Informática', '💻',
   'Formatação, remoção de vírus, upgrade de hardware, redes e configuração de Wi-Fi.',
   70.00, 350.00, 9, true),

  ('limpeza', 'Limpeza', '🧹',
   'Faxina comum, limpeza pesada, pós-obra e higienização de estofados.',
   120.00, 350.00, 10, true),

  ('marceneiro', 'Marceneiro', '🪚',
   'Móveis sob medida, ajuste de portas e gavetas, restauro e reparos em madeira.',
   200.00, 1800.00, 11, true),

  ('serralheiro', 'Serralheiro', '🔩',
   'Portões, grades, corrimãos, soldas e manutenção de estruturas metálicas.',
   150.00, 1200.00, 12, true),

  ('chaveiro', 'Chaveiro', '🔑',
   'Abertura de portas, troca e reparo de fechaduras, cópia de chaves e chave codificada.',
   60.00, 300.00, 13, true),

  ('instalacao-tv', 'Instalação / TV', '📺',
   'Suporte de TV na parede, home theater, antena, receptor e organização de cabos.',
   80.00, 300.00, 14, true)
on conflict (slug) do update set
  name        = excluded.name,
  icon        = excluded.icon,
  description = excluded.description,
  price_from  = excluded.price_from,
  price_to    = excluded.price_to,
  sort_order  = excluded.sort_order,
  active      = excluded.active;

-- Conferência rápida do que foi carregado:
-- select sort_order, icon, name, price_from, price_to from public.categories order by sort_order;


-- =====================================================================
-- 2. USUÁRIOS DE TESTE — COMO CRIAR (NÃO EXECUTE INSERTS EM auth.users)
-- =====================================================================
--
-- A tabela auth.users é gerenciada pelo GoTrue (serviço de autenticação do
-- Supabase). Inserir linhas nela manualmente pelo SQL Editor quebra hashes
-- de senha, identidades e confirmação de e-mail — por isso este seed NÃO
-- cria usuários. Use um dos caminhos abaixo.
--
-- ---------------------------------------------------------------------
-- OPÇÃO A — Painel do Supabase (mais simples)
-- ---------------------------------------------------------------------
-- 1) Vá em Authentication > Users > "Add user" > "Create new user".
-- 2) Marque "Auto Confirm User" para não precisar confirmar o e-mail.
-- 3) Crie os três usuários sugeridos:
--
--      admin@servego.com.br       / Servego@2025
--      cliente@servego.com.br     / Servego@2025
--      eletricista@servego.com.br / Servego@2025
--
-- 4) Em "User Metadata" (raw_user_meta_data) informe o JSON abaixo para
--    que a trigger public.handle_new_user() já monte o profile certo:
--
--      Cliente:
--        { "full_name": "Ana Souza", "phone": "+5511988887777", "role": "client" }
--
--      Profissional (também cria a linha em public.professionals):
--        { "full_name": "Carlos Lima", "phone": "+5511977776666", "role": "professional" }
--
--      Admin (crie como client e promova no passo 3 deste arquivo):
--        { "full_name": "Equipe ServeGo", "role": "client" }
--
-- ---------------------------------------------------------------------
-- OPÇÃO B — Pelo app / SDK (fluxo real de cadastro)
-- ---------------------------------------------------------------------
--   await supabase.auth.signUp({
--     email: 'eletricista@servego.com.br',
--     password: 'Servego@2025',
--     options: { data: { full_name: 'Carlos Lima', phone: '+5511977776666', role: 'professional' } }
--   })
--
-- ---------------------------------------------------------------------
-- OPÇÃO C — Admin API (scripts de e2e / CI), com a service_role key
-- ---------------------------------------------------------------------
--   curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
--     -H "apikey: $SERVICE_ROLE_KEY" \
--     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"cliente@servego.com.br","password":"Servego@2025",
--          "email_confirm":true,
--          "user_metadata":{"full_name":"Ana Souza","role":"client"}}'


-- =====================================================================
-- 3. PROMOVER UM USUÁRIO A ADMINISTRADOR
--    Rode DEPOIS de criar o usuário por um dos caminhos acima.
--    Troque o e-mail pelo do seu usuário administrador.
-- =====================================================================
-- update public.profiles
--    set role = 'admin'
--  where email = 'admin@servego.com.br';


-- =====================================================================
-- 4. AJUSTES OPCIONAIS DO PROFISSIONAL DE TESTE
--    Rode DEPOIS de criar o usuário profissional. Substitua o e-mail.
--    Sem estes dados o profissional não aparece em search_professionals,
--    que exige: perfil ativo + is_available + verificado/aprovado +
--    vínculo com a categoria + coordenadas dentro do raio.
-- =====================================================================
-- do $$
-- declare
--   v_pro_id uuid;
--   v_cat_id uuid;
-- begin
--   select id into v_pro_id from public.profiles   where email = 'eletricista@servego.com.br';
--   select id into v_cat_id from public.categories where slug  = 'eletricista';
--
--   if v_pro_id is null then
--     raise notice 'Crie o usuário no Auth antes de rodar este bloco.';
--     return;
--   end if;
--
--   -- garante a ficha de profissional (caso o role tenha sido ajustado depois)
--   update public.profiles set role = 'professional' where id = v_pro_id;
--   insert into public.professionals (id) values (v_pro_id) on conflict (id) do nothing;
--
--   update public.professionals set
--     headline            = 'Eletricista residencial com 12 anos de experiência',
--     bio                 = 'Atendo emergências 24h na zona sul de São Paulo. Serviço com garantia de 90 dias.',
--     experience_years    = 12,
--     base_price          = 120.00,
--     hourly_rate         = 90.00,
--     service_radius_km   = 20,
--     lat                 = -23.561414,   -- Av. Paulista, São Paulo/SP
--     lng                 = -46.655881,
--     city                = 'São Paulo',
--     state               = 'SP',
--     is_available        = true,
--     verified            = true,
--     verification_status = 'approved',
--     response_time_min   = 12
--   where id = v_pro_id;
--
--   insert into public.professional_categories (professional_id, category_id, price_from)
--   values (v_pro_id, v_cat_id, 120.00)
--   on conflict (professional_id, category_id) do update set price_from = excluded.price_from;
-- end $$;
--
-- -- Teste da busca (Av. Paulista, raio de 25 km):
-- -- select * from public.search_professionals(
-- --   (select id from public.categories where slug = 'eletricista'),
-- --   -23.561414, -46.655881, 25, 20
-- -- );

-- Fim do 04_seed.sql

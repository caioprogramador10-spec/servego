-- =====================================================================
-- ServeGo — 05_admin.sql
-- Trava o papel de ADMINISTRADOR em uma única conta: a do proprietário.
--
-- Rode DEPOIS de 01_schema.sql, 02_rls.sql, 03_storage.sql e 04_seed.sql.
-- É idempotente: pode rodar quantas vezes quiser.
--
-- Para trocar o dono no futuro, altere o e-mail em servego_owner_email()
-- (e o mesmo e-mail em js/config.js → owner.email) e rode este arquivo de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quem é o dono
-- ---------------------------------------------------------------------
create or replace function public.servego_owner_email()
returns text
language sql
immutable
as $$
  select lower('caio.programador10@gmail.com')
$$;
comment on function public.servego_owner_email() is
  'E-mail da única conta autorizada a ter role = admin no ServeGo.';

-- ---------------------------------------------------------------------
-- 2. Blindagem do papel de admin
--    - o e-mail do dono vira admin automaticamente (insert e update)
--    - qualquer outra conta é impedida de virar admin, venha de onde vier
--      (formulário, API com a anon key, update direto pelo próprio usuário)
-- ---------------------------------------------------------------------
create or replace function public.enforce_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = public.servego_owner_email() then
    -- o dono é sempre administrador
    new.role := 'admin';
    new.status := 'active';
  elsif new.role = 'admin' then
    raise exception
      'Somente a conta proprietária do ServeGo pode ter papel de administrador.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
comment on function public.enforce_admin_role() is
  'Garante que apenas servego_owner_email() tenha role = admin.';

drop trigger if exists trg_profiles_enforce_admin on public.profiles;
create trigger trg_profiles_enforce_admin
  before insert or update of role, email on public.profiles
  for each row execute function public.enforce_admin_role();

-- ---------------------------------------------------------------------
-- 3. O dono nunca é tratado como profissional
--    (se ele se cadastrar escolhendo "sou profissional", a ficha é removida)
-- ---------------------------------------------------------------------
create or replace function public.cleanup_owner_professional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.id
      and lower(coalesce(p.email, '')) = public.servego_owner_email()
  ) then
    return null; -- cancela a criação da ficha de profissional para o dono
  end if;
  return new;
end;
$$;

drop trigger if exists trg_professionals_block_owner on public.professionals;
create trigger trg_professionals_block_owner
  before insert on public.professionals
  for each row execute function public.cleanup_owner_professional();

-- ---------------------------------------------------------------------
-- 4. Correção do que já existe no banco
--    - promove o dono, se a conta já tiver sido criada
--    - rebaixa qualquer outro admin que exista
-- ---------------------------------------------------------------------
update public.profiles
   set role = 'admin'
 where lower(coalesce(email, '')) = public.servego_owner_email()
   and role is distinct from 'admin';

update public.profiles
   set role = 'client'
 where role = 'admin'
   and lower(coalesce(email, '')) <> public.servego_owner_email();

delete from public.professionals
 where id in (
   select id from public.profiles
    where lower(coalesce(email, '')) = public.servego_owner_email()
 );

-- ---------------------------------------------------------------------
-- 5. Conferência
-- ---------------------------------------------------------------------
-- select id, email, role from public.profiles where role = 'admin';
--   → deve retornar exatamente uma linha, a do proprietário.

-- =====================================================================
-- COMO CRIAR A CONTA DO ADMINISTRADOR
-- =====================================================================
-- Opção A (recomendada) — pelo painel do Supabase:
--   Authentication → Users → "Add user" → "Create new user"
--   E-mail: caio.programador10@gmail.com
--   Password: (a senha que você escolheu)
--   Marque "Auto Confirm User".
--   O trigger acima promove a conta a admin automaticamente.
--
-- Opção B — pelo próprio ServeGo:
--   Abra o app, clique em "Criar conta", cadastre-se com esse e-mail.
--   O cadastro público só oferece cliente/profissional, mas o banco
--   promove essa conta a admin no momento em que o profile é criado.
--
-- IMPORTANTE: a senha vive apenas no Supabase Auth (hash), nunca no código
-- do front-end. Nenhum arquivo do projeto deve conter a senha em texto.
-- =====================================================================

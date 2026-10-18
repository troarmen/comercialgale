-- =============================================================================
-- 005 — Papel do usuário novo só pode ser definido pelo servidor
--
-- POR QUÊ (BRECHA): `handle_new_user` lia o papel de `raw_user_meta_data`,
-- que é escrito pelo PRÓPRIO usuário no cadastro. Com o signup do Supabase
-- Auth aberto (padrão do projeto hospedado) e a chave anon pública, bastava
--
--   POST /auth/v1/signup  {"email": …, "password": …, "data": {"role": "admin"}}
--
-- e confirmar o próprio e-mail para entrar no /admin como administrador.
--
-- `raw_app_meta_data` só é gravável com a service_role
-- (`auth.admin.createUser({ app_metadata })`), ou seja, só pelo painel.
-- O nome continua vindo do user_metadata — é só exibição.
--
-- Rode inteiro. Está em transação. Depois:
--   1. Supabase → Authentication → Sign In / Providers → desligar
--      "Allow new users to sign up". O site nunca usa signUp; o painel cria
--      os logins com a API de admin, que funciona com o signup desligado.
--   2. Rode a auditoria do fim deste arquivo.
-- =============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    coalesce((new.raw_app_meta_data ->> 'role')::app_role, 'cliente')
  );
  return new;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- AUDITORIA — quem tem papel diferente de cliente hoje. Tem de bater com a
-- lista de pessoas que vocês cadastraram à mão. Qualquer outro nome: desative
-- (update public.profiles set ativo = false where id = '…') e investigue.
-- -----------------------------------------------------------------------------
-- select u.email, p.nome, p.role, p.ativo, u.created_at, u.last_sign_in_at
--   from public.profiles p
--   join auth.users u on u.id = p.id
--  where p.role <> 'cliente'
--  order by u.created_at;

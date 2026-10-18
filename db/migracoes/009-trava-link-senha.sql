-- =============================================================================
-- 009 — Trava de reenvio do link de senha
--
-- O "esqueci minha senha" gera o link com auth.admin.generateLink e manda o
-- e-mail pelo nosso SMTP (Brevo), com o nosso texto. Diferente do
-- resetPasswordForEmail, o generateLink NÃO tem limite de frequência: sem
-- trava, qualquer um poderia disparar dezenas de e-mails para a caixa de um
-- lojista (e queimar a reputação do domínio no Brevo).
--
-- O generateLink grava auth.users.recovery_sent_at. Esta função diz se o
-- último envio para o e-mail foi há mais de 60 s. Mora em `public` porque o
-- PostgREST não expõe `auth`; é security definer para ler auth.users e só a
-- service_role executa — o navegador nunca chama.
--
-- E-mail sem conta devolve TRUE de propósito: quem decide é o generateLink
-- (404), e a tela responde igual nos dois casos para não revelar quem tem
-- conta.
--
-- Rode inteiro. Está em transação.
-- =============================================================================

begin;

create or replace function public.link_senha_liberado(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select recovery_sent_at < now() - interval '60 seconds'
            or recovery_sent_at is null
       from auth.users
      where lower(email) = lower(trim(p_email))
      limit 1),
    true);
$$;

revoke execute on function public.link_senha_liberado(text) from public, anon, authenticated;
grant  execute on function public.link_senha_liberado(text) to service_role;

commit;

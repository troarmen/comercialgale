-- =============================================================================
-- 008 — Colaborador pode mudar a SITUAÇÃO do pedido (e nada mais)
--
-- Pedido do Arthur (18/10/2026): quem separa e envia atualiza o status.
--
-- POR QUE FUNÇÃO E NÃO POLÍTICA DE UPDATE: trava de coluna no Postgres vale
-- por papel do BANCO (`authenticated`), e admin e colaborador são o mesmo
-- papel. Uma política de UPDATE para a equipe deixaria o colaborador mudar
-- total, desconto, anotações. A função abaixo muda SÓ o status; o colaborador
-- continua sem nenhum UPDATE direto em `pedidos`.
--
-- O registro em log_atividades é feito aqui dentro (security definer) — o
-- colaborador não tem INSERT em log_atividades, e assim o log não depende de
-- a aplicação lembrar de gravar.
--
-- Rode inteiro. Está em transação. Requer a 007 (is_equipe).
-- =============================================================================

begin;

create or replace function public.mudar_status_pedido(
  p_id bigint,
  p_status public.pedido_status
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_anterior public.pedido_status;
begin
  if not public.is_equipe() then
    raise exception 'sem permissão para mudar o pedido' using errcode = '42501';
  end if;

  select status into v_anterior from public.pedidos where id = p_id for update;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'P0002';
  end if;
  if v_anterior = p_status then
    return;
  end if;

  update public.pedidos set status = p_status where id = p_id;

  insert into public.log_atividades (user_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'editou', 'pedido', p_id::text,
          jsonb_build_object('campo', 'status', 'anterior', v_anterior, 'novo', p_status));
end $$;

-- Função nasce executável por PUBLIC (inclusive anon). A checagem interna já
-- barraria, mas não há motivo para expor a visitante.
revoke execute on function public.mudar_status_pedido(bigint, public.pedido_status) from public, anon;
grant  execute on function public.mudar_status_pedido(bigint, public.pedido_status) to authenticated;

commit;

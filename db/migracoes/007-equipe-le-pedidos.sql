-- =============================================================================
-- 007 — Colaborador lê pedidos (e só pedidos)
--
-- `is_equipe()` = admin OU colaborador, ativo. O colaborador ganha SELECT em
-- `pedidos` e `pedido_itens` e NADA mais:
--
--   • sem INSERT/UPDATE/DELETE — o "admin total" continua exigindo is_admin();
--   • sem SELECT em `clientes` — a ficha do pedido mostra o cliente pelo
--     `snapshot_cliente` congelado no próprio pedido, que é o endereço para
--     onde ele foi enviado. A base de 1.825 cadastros (CPF/CNPJ) fica fora;
--   • sem preço de catálogo — pode_ver_precos() continua só admin/cliente.
--
-- Pedido continua invisível para CLIENTE (PAINEL.md §4): estas políticas
-- só valem para quem tem profile admin/colaborador.
--
-- Para liberar a troca de status no futuro: uma política de UPDATE com
-- is_equipe() + trava de coluna (grant update (status)) e trocar
-- exigirAdmin() por exigirEquipe() em `mudarStatus`.
--
-- Rode DEPOIS da 006. Está em transação.
-- =============================================================================

begin;

create or replace function public.is_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'colaborador') and ativo
  );
$$;

create policy "equipe le pedidos" on public.pedidos
  for select using (public.is_equipe());

create policy "equipe le itens" on public.pedido_itens
  for select using (public.is_equipe());

commit;

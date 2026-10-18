-- =============================================================================
-- 006 — Papel "colaborador"
--
-- Pedido do cliente: funcionários que consultam pedidos no painel sem poder
-- editar nada. As políticas que usam o papel estão na 007.
--
-- RODE SOZINHO, SEM begin/commit, e ANTES da 007: o Postgres não deixa usar
-- um valor novo de enum na mesma transação em que ele foi criado.
-- =============================================================================

alter type public.app_role add value if not exists 'colaborador';

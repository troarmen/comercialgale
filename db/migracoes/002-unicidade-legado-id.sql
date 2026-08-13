-- =============================================================================
-- 002 — Unicidade de `clientes.legado_id` + leitura pública de configurações
--
-- (1) O índice parcial impedia o upsert por `legado_id`: o Postgres recusa
--     índice com WHERE em ON CONFLICT. Trocamos por uma constraint normal.
--     Não muda o comportamento: UNIQUE no Postgres aceita vários NULL, então
--     clientes cadastrados pelo painel (sem legado_id) continuam livres.
--
-- (2) Aproveitando a mesma janela, entra a política que estava anotada em
--     db/alteracoes-pendentes.sql — o catálogo vai precisar ler três chaves de
--     configuração. `emails_notificacao` continua restrito ao painel.
--
-- Rode inteiro. Está em transação.
-- =============================================================================

begin;

drop index if exists public.clientes_legado_id_uniq;

alter table public.clientes
  add constraint clientes_legado_id_key unique (legado_id);

create policy "config publica" on public.configuracoes
  for select
  using (chave in (
    'pedido_minimo_valor',
    'catalogo_aviso',
    'exibir_preco_varejo'
  ));

commit;

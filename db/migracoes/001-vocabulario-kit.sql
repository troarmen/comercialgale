-- =============================================================================
-- 001 — Vocabulário: "pacote/embalagem" vira "kit"
--
-- O Arthur chama de KIT, e é assim que o sistema da loja dele fala. A interface
-- já foi ajustada; esta migração alinha o banco, para código e negócio usarem
-- a mesma palavra.
--
-- Seguro de rodar: são renomeações, nenhum dado é reescrito. As colunas
-- geradas de `pedido_itens` acompanham o novo nome sozinhas, porque o Postgres
-- guarda a referência interna, não o texto.
--
-- Rode INTEIRO de uma vez — está numa transação, então ou tudo passa ou nada
-- muda.
-- =============================================================================

begin;

alter table public.embalagens rename to kits;

alter table public.produtos      rename column embalagem_id         to kit_id;
alter table public.pedido_itens  rename column pecas_por_pacote     to pecas_no_kit;
alter table public.pedido_itens  rename column qtd_pacotes          to qtd_kits;
alter table public.pedido_itens  rename column preco_pacote_atacado to preco_kit_atacado;
alter table public.pedido_itens  rename column preco_pacote_varejo  to preco_kit_varejo;

-- A view precisa ser recriada: renomear a tabela não muda os nomes das colunas
-- que ela devolve, e é por eles que a aplicação lê.
drop view public.precos_visiveis;

create view public.precos_visiveis as
select
  p.id                                        as produto_id,
  pt.id                                       as produto_tamanho_id,
  t.valor                                     as tamanho,
  k.pecas                                     as pecas_no_kit,
  -- preço do kit, já resolvida a herança tamanho → produto
  coalesce(pt.preco_atacado, p.preco_atacado) as preco_kit_atacado,
  coalesce(pt.preco_varejo,  p.preco_varejo)  as preco_kit_varejo,
  -- valor por peça, como o cliente vê na tela do pedido
  round(coalesce(pt.preco_atacado, p.preco_atacado) / k.pecas, 2) as preco_unitario_atacado,
  round(coalesce(pt.preco_varejo,  p.preco_varejo)  / k.pecas, 2) as preco_unitario_varejo
from public.produtos p
join public.kits k             on k.id = p.kit_id
left join public.produto_tamanhos pt on pt.produto_id = p.id and pt.ativo
left join public.tamanhos t          on t.id = pt.tamanho_id
where public.pode_ver_precos()
  and (p.ativo or public.is_admin());

-- O DROP levou os privilégios junto; precisam voltar.
grant select on public.precos_visiveis to anon, authenticated;

commit;

-- Conferência rápida depois de rodar:
--   select count(*) from public.kits;                    -- 8
--   select count(*) from public.precos_visiveis;         -- 1417
--   select * from public.precos_visiveis limit 1;        -- colunas com "kit"

-- =============================================================================
-- 003 — A view de preços passa a distinguir preço PRÓPRIO de preço HERDADO
--
-- POR QUÊ: no cadastro de produto, o campo de preço de cada tamanho precisa
-- vir preenchido só quando aquele tamanho tem valor próprio. A view atual já
-- resolve a herança (coalesce), então não dava para saber a origem do número —
-- e salvar o formulário transformaria preço herdado em preço fixo, ou apagaria
-- o preço próprio dos 30 produtos que cobram mais nos tamanhos grandes.
--
-- As colunas de preço das tabelas continuam bloqueadas para anon/authenticated.
-- Esta view segue sendo a única porta, e continua fechada por pode_ver_precos().
--
-- Rode inteiro. Está em transação.
-- =============================================================================

begin;

drop view public.precos_visiveis;

create view public.precos_visiveis as
select
  p.id                                        as produto_id,
  pt.id                                       as produto_tamanho_id,
  t.valor                                     as tamanho,
  k.pecas                                     as pecas_no_kit,

  -- preço do kit já com a herança resolvida (é o que o catálogo usa)
  coalesce(pt.preco_atacado, p.preco_atacado) as preco_kit_atacado,
  coalesce(pt.preco_varejo,  p.preco_varejo)  as preco_kit_varejo,

  -- preço do produto, sem considerar tamanho
  p.preco_atacado                             as preco_base_atacado,
  p.preco_varejo                              as preco_base_varejo,

  -- preço específico do tamanho; NULL quando ele herda do produto
  pt.preco_atacado                            as preco_proprio_atacado,
  pt.preco_varejo                             as preco_proprio_varejo,

  round(coalesce(pt.preco_atacado, p.preco_atacado) / k.pecas, 2) as preco_unitario_atacado,
  round(coalesce(pt.preco_varejo,  p.preco_varejo)  / k.pecas, 2) as preco_unitario_varejo
from public.produtos p
join public.kits k                   on k.id = p.kit_id
left join public.produto_tamanhos pt on pt.produto_id = p.id and pt.ativo
left join public.tamanhos t          on t.id = pt.tamanho_id
where public.pode_ver_precos()
  and (p.ativo or public.is_admin());

grant select on public.precos_visiveis to anon, authenticated;

commit;

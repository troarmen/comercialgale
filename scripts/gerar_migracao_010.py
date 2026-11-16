#!/usr/bin/env python3
"""
Gera db/migracoes/010-data-cadastro-produtos.sql a partir do legado.

Por quê: na importação todos os produtos ganharam `created_at` = dia da
importação (ago/2026). A lista do painel passou a mostrar a coluna "Cadastro"
(pedido do cliente, nov/2026), e com a data da importação ela diria que os 556
produtos nasceram no mesmo dia. O sistema antigo tem a data verdadeira em
`data_cadastro` (dd/mm/aaaa) de cada produto.

O arquivo de saída leva SÓ `legado_id` e data — nada de nome, preço ou dado
de cliente —, então pode ir para o repositório. O `produtos.jsonl` continua
fora dele (ver .gitignore).

Uso:
    python3 scripts/gerar_migracao_010.py
    python3 scripts/gerar_migracao_010.py --legado /caminho/para/produtos.jsonl

Sem `--legado`, lê db/migracao/legado/produtos.jsonl deste repositório.
"""

import json
import os
import sys
from collections import Counter
from datetime import datetime

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PADRAO = os.path.join(RAIZ, "db", "migracao", "legado", "produtos.jsonl")
SAIDA = os.path.join(RAIZ, "db", "migracoes", "010-data-cadastro-produtos.sql")

CABECALHO = """\
-- =============================================================================
-- 010 — Data real de cadastro dos produtos (e data dos clientes do site)
--
-- POR QUÊ: a lista de produtos do painel ganhou a coluna "Cadastro" (pedido
-- do cliente, nov/2026), lida de `produtos.created_at`. Só que `created_at`
-- marca quando a linha entrou NESTE banco: na importação os {total} produtos
-- ficaram todos com o mesmo dia de agosto de 2026, e a coluna diria isso de
-- todos. O sistema antigo tem a data verdadeira de cada produto; esta
-- migração a traz, casando por `legado_id`. Produto criado pelo painel (sem
-- `legado_id`) não é tocado.
--
-- O legado só guarda o DIA. Gravamos meio-dia de São Paulo: assim a data não
-- muda de dia em nenhum fuso em que o painel ou o catálogo a exibam.
--
-- `updated_at` é preservado: o gatilho t_produtos o poria em now() em todos
-- os {total}, e o sitemap usa `updated_at` como `lastmod` — o Google
-- receberia "{total} páginas mudaram hoje" sem nada ter mudado. Por isso o
-- gatilho fica desligado só durante o UPDATE (DISABLE TRIGGER é
-- transacional: se algo falhar, o rollback o religa junto).
--
-- CLIENTES: a lista de clientes ganhou a coluna "Cadastro" (cadastrado_em).
-- Cliente que ficou sem data recebe o dia em que a linha entrou no banco, e o
-- valor padrão da coluna passa de `current_date` (dia do servidor, UTC) para
-- o dia de São Paulo: quem se cadastra às 22h não pode ganhar a data de
-- amanhã.
--
-- BACKUP: antes de sobrescrever, o valor antigo vai para duas tabelas criadas
-- aqui — `_backup_010_produtos_created_at` (o `created_at` de antes de cada
-- produto alterado) e `_backup_010_clientes_sem_data` (os clientes que
-- estavam sem `cadastrado_em`). Sem acesso para anon/authenticated (RLS
-- ligado e sem política, privilégios revogados): só o SQL Editor as lê.
--
-- PODE RODAR DE NOVO: só muda o que ainda está diferente, e o backup nunca é
-- sobrescrito — numa segunda rodada ele continua guardando o valor ORIGINAL,
-- não o da primeira rodada.
--
-- REVERTER (rode inteiro, também em transação):
--
--   begin;
--   alter table public.produtos disable trigger t_produtos;
--   update public.produtos p
--      set created_at = b.created_at_antigo
--     from public._backup_010_produtos_created_at b
--    where b.produto_id = p.id;
--   alter table public.produtos enable trigger t_produtos;
--   update public.clientes c
--      set cadastrado_em = null
--     from public._backup_010_clientes_sem_data b
--    where b.cliente_id = c.id;
--   alter table public.clientes alter column cadastrado_em set default current_date;
--   drop table public._backup_010_produtos_created_at;
--   drop table public._backup_010_clientes_sem_data;
--   commit;
--
-- Quando as datas estiverem conferidas e ninguém precisar mais voltar atrás,
-- as duas tabelas de backup podem ser apagadas (os dois `drop table` acima).
--
-- O painel funciona igual sem esta migração — ela só corrige as datas.
-- Gerado por scripts/gerar_migracao_010.py (só ids e datas, nada pessoal).
--
-- Rode inteiro. Está em transação.
-- =============================================================================

begin;

-- ---------------------------------------------------------------- backup
create table if not exists public._backup_010_produtos_created_at (
  produto_id        bigint primary key,
  created_at_antigo timestamptz not null,
  guardado_em       timestamptz not null default now()
);
create table if not exists public._backup_010_clientes_sem_data (
  cliente_id  bigint primary key,
  guardado_em timestamptz not null default now()
);
-- O Supabase concede tudo em tabela nova do `public` a anon/authenticated
-- (privilégio padrão): sem isto, o backup sairia pela API.
alter table public._backup_010_produtos_created_at enable row level security;
alter table public._backup_010_clientes_sem_data   enable row level security;
revoke all on public._backup_010_produtos_created_at from public, anon, authenticated;
revoke all on public._backup_010_clientes_sem_data   from public, anon, authenticated;

-- ---------------------------------------------------------------- produtos
create temp table _010_datas (legado_id bigint primary key, data date not null)
  on commit drop;

insert into _010_datas (legado_id, data) values
"""

RODAPE = """\
;

-- Guarda o valor de antes só de quem vai mudar. `do nothing`: se a migração
-- rodar de novo, o backup continua com o valor original.
insert into public._backup_010_produtos_created_at (produto_id, created_at_antigo)
select p.id, p.created_at
  from public.produtos p
  join _010_datas v on v.legado_id = p.legado_id
 where p.created_at is distinct from
       (v.data + time '12:00') at time zone 'America/Sao_Paulo'
on conflict (produto_id) do nothing;

alter table public.produtos disable trigger t_produtos;

update public.produtos p
   set created_at = (v.data + time '12:00') at time zone 'America/Sao_Paulo'
  from _010_datas v
 where p.legado_id = v.legado_id
   and p.created_at is distinct from
       (v.data + time '12:00') at time zone 'America/Sao_Paulo';

alter table public.produtos enable trigger t_produtos;

-- ---------------------------------------------------------------- clientes
insert into public._backup_010_clientes_sem_data (cliente_id)
select id from public.clientes where cadastrado_em is null
on conflict (cliente_id) do nothing;

alter table public.clientes
  alter column cadastrado_em set default (now() at time zone 'America/Sao_Paulo')::date;

update public.clientes
   set cadastrado_em = (created_at at time zone 'America/Sao_Paulo')::date
 where cadastrado_em is null;

commit;

-- Confira depois de rodar:
--   select extract(year from created_at at time zone 'America/Sao_Paulo') as ano,
--          count(*)
--     from public.produtos where legado_id is not null group by 1 order by 1;
--   -- esperado: {esperado}
--   select count(*) from public.clientes where cadastrado_em is null;  -- 0
--   select count(*) from public._backup_010_produtos_created_at;
--   -- na primeira rodada: os produtos cuja data mudou (até {total})
"""


def main():
    caminho = PADRAO
    if "--legado" in sys.argv:
        caminho = sys.argv[sys.argv.index("--legado") + 1]

    linhas = []
    vistos = set()
    with open(caminho, encoding="utf-8") as f:
        for bruta in f:
            if not bruta.strip():
                continue
            p = json.loads(bruta)
            legado_id = int(p["legado_id"])
            texto = (p.get("data_cadastro") or "").strip()
            if not texto or legado_id in vistos:
                continue
            # dd/mm/aaaa -> aaaa-mm-dd; data inválida derruba o script em vez
            # de virar uma linha errada na migração
            data = datetime.strptime(texto, "%d/%m/%Y").date()
            vistos.add(legado_id)
            linhas.append((legado_id, data))

    linhas.sort()
    por_ano = Counter(d.year for _, d in linhas)
    esperado = ", ".join(f"{ano}={n}" for ano, n in sorted(por_ano.items()))

    corpo = ",\n".join(f"  ({i}, '{d.isoformat()}')" for i, d in linhas)
    with open(SAIDA, "w", encoding="utf-8") as f:
        f.write(CABECALHO.format(total=len(linhas)))
        f.write(corpo + "\n")
        f.write(RODAPE.format(esperado=esperado, total=len(linhas)))

    print(f"{len(linhas)} produtos -> {os.path.relpath(SAIDA, RAIZ)}")
    print(f"por ano: {esperado}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Importa clientes e pedidos extraídos do sistema antigo para o Supabase.

Idempotente: cada tabela tem `legado_id` único e usamos upsert por ele.

Uso:
    python3 scripts/importar_clientes_pedidos.py            # tudo
    python3 scripts/importar_clientes_pedidos.py clientes
    python3 scripts/importar_clientes_pedidos.py pedidos
"""
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime

import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGADO = os.path.join(RAIZ, "db", "migracao", "legado")
LOTE = 200

STATUS_CLIENTE = {"0": "inativo", "1": "ativo", "2": "incompleto"}
TIPO_PESSOA = {"0": "fisica", "1": "juridica"}
TIPO_COMPRA = {"1": "atacado", "2": "varejo"}

# Status do pedido no legado. O `0` não existe na lista do painel antigo —
# são 8 pedidos com lixo de banco; entram como cancelados.
STATUS_PEDIDO = {
    "0": "cancelado",
    "1": "aguardando_pagamento",
    "2": "pago",
    "3": "cancelado",
}


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def env():
    d = {}
    for linha in open(os.path.join(RAIZ, ".env.local"), encoding="utf-8"):
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            d[k.strip()] = v.strip()
    return d


E = env()
URL = E["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = E["SUPABASE_SERVICE_ROLE_KEY"]
S = requests.Session()
S.headers.update({
    "apikey": KEY, "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
})


def L(nome):
    caminho = os.path.join(LEGADO, nome)
    with open(caminho, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def enviar(tabela, linhas, conflito="legado_id", devolver=True):
    if not linhas:
        return []
    saida = []
    prefer = ("resolution=merge-duplicates,"
              + ("return=representation" if devolver else "return=minimal"))
    for i in range(0, len(linhas), LOTE):
        lote = linhas[i:i + LOTE]
        r = S.post(f"{URL}/rest/v1/{tabela}?on_conflict={conflito}",
                   headers={"Prefer": prefer},
                   data=json.dumps(lote), timeout=180)
        if r.status_code >= 300:
            raise SystemExit(f"FALHA em {tabela} (HTTP {r.status_code}): {r.text[:700]}")
        if devolver:
            saida += r.json()
        if (i // LOTE) % 5 == 4:
            log(f"    {min(i + LOTE, len(linhas))}/{len(linhas)}")
    return saida


def data_br(s, com_hora=False):
    """'13/06/2017' ou '13/06/2017 13:35' -> ISO. None se não der."""
    if not s:
        return None
    s = s.strip()
    for formato in ("%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            d = datetime.strptime(s[: len(formato) + 2].strip(), formato)
            return d.isoformat() if com_hora else d.date().isoformat()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------- clientes

def importar_clientes():
    linhas = L("clientes.jsonl")
    log(f"Clientes: {len(linhas)}")

    registros = []
    for c in linhas:
        tipo = TIPO_PESSOA.get(c.get("tipo_pessoa_legado") or "0", "fisica")
        registros.append({
            "legado_id": c["legado_id"],
            "status": STATUS_CLIENTE.get(c.get("status_legado") or "2", "incompleto"),
            "tipo_pessoa": tipo,
            "tipo_compra": TIPO_COMPRA.get(c.get("tipo_compra_legado") or "", "atacado"),
            "cliente_antigo": c.get("tipo_cadastro_legado") == "2",
            "nome": c["nome"] or "(sem nome)",
            "nome_fantasia": c.get("nome_fantasia"),
            "documento": c.get("documento"),
            "rg": c.get("rg"),
            "inscricao_estadual": c.get("inscricao_estadual"),
            "data_nascimento": data_br(c.get("data_nascimento")),
            "email": c.get("email"),
            "telefone1": c.get("telefone1"),
            "telefone2": c.get("telefone2"),
            "telefone3": c.get("telefone3"),
            "nome_contato": c.get("nome_contato"),
            "cep": c.get("cep"),
            "logradouro": c.get("logradouro"),
            "numero": c.get("numero"),
            "complemento": c.get("complemento"),
            "bairro": c.get("bairro"),
            "cidade": c.get("cidade"),
            "uf": (c.get("uf") or "")[:2] or None,
            "pais": c.get("pais") or "Brasil",
            "observacoes": c.get("observacoes"),
        })

    gravados = enviar("clientes", registros)
    log(f"  {len(gravados)} clientes no banco")
    return {g["legado_id"]: g["id"] for g in gravados}


# ----------------------------------------------------------------------- pedidos

def escolher_cliente(pedido, por_nome, clientes_por_legado_id):
    """
    O pedido antigo só guarda o NOME do cliente. Oito nomes se repetem — quase
    sempre a mesma pessoa cadastrada como física e como jurídica.

    Desempate, em ordem:
      1. o tipo de pessoa que o próprio pedido registra
      2. o cadastro que já existia na data do pedido
      3. o cadastro mais antigo, marcando o pedido para revisão
    """
    nome = (pedido.get("cliente_nome") or "").strip()
    candidatos = por_nome.get(nome, [])
    if not candidatos:
        return None, False
    if len(candidatos) == 1:
        return candidatos[0], False

    tipo_pedido = (pedido.get("tipo_pessoa") or "").strip()
    esperado = "1" if "Jur" in tipo_pedido else "0" if "Fís" in tipo_pedido or "Fis" in tipo_pedido else None
    if esperado:
        filtrados = [c for c in candidatos if (c.get("tipo_pessoa_legado") or "0") == esperado]
        if len(filtrados) == 1:
            return filtrados[0], False
        if filtrados:
            candidatos = filtrados

    dp = data_br(pedido.get("data"))
    if dp:
        anteriores = [
            c for c in candidatos
            if (d := data_br(c.get("data_cadastro"))) and d <= dp
        ]
        if len(anteriores) == 1:
            return anteriores[0], False
        if anteriores:
            candidatos = anteriores

    # empate: fica o cadastro mais antigo e o pedido vai para revisão
    candidatos = sorted(candidatos, key=lambda c: c["legado_id"])
    return candidatos[0], True


def importar_pedidos(mapa_clientes):
    clientes = L("clientes.jsonl")
    pedidos = L("pedidos.jsonl")
    log(f"Pedidos: {len(pedidos)}")

    por_nome = defaultdict(list)
    for c in clientes:
        por_nome[c["nome"].strip()].append(c)

    # produtos existentes, para ligar o item ao produto quando a referência
    # ainda existir no catálogo
    produtos = {}
    r = S.get(f"{URL}/rest/v1/produtos?select=id,modelo,titulo", timeout=120)
    for p in r.json():
        produtos[(p["modelo"].strip(), p["titulo"].strip())] = p["id"]
        produtos.setdefault(p["modelo"].strip(), p["id"])

    registros, sem_cliente, revisar = [], [], 0
    for p in pedidos:
        cliente, ambiguo = escolher_cliente(p, por_nome, mapa_clientes)
        if not cliente:
            sem_cliente.append(p["numero"])
            continue
        revisar += ambiguo
        registros.append({
            "legado_id": p["legado_id"],
            "numero": p["numero"],
            "cliente_id": mapa_clientes[cliente["legado_id"]],
            "status": STATUS_PEDIDO.get(p.get("status_legado") or "1", "aguardando_pagamento"),
            "vinculo_revisar": ambiguo,
            "criado_em": data_br(p.get("data"), com_hora=True),
            "snapshot_cliente": {
                "nome": p.get("cliente_nome"),
                "tipo_pessoa": p.get("tipo_pessoa"),
                "origem": "sistema antigo",
            },
            # totais entram zerados: o gatilho recalcula a partir dos itens
            "total_atacado": 0, "total_varejo": 0, "total_pecas": 0,
        })

    if sem_cliente:
        log(f"  AVISO: {len(sem_cliente)} pedidos sem cliente correspondente: {sem_cliente[:5]}")

    gravados = enviar("pedidos", registros)
    mapa_pedidos = {g["legado_id"]: g["id"] for g in gravados}
    log(f"  {len(gravados)} pedidos no banco · {revisar} marcados para revisão de vínculo")

    itens = []
    for p in pedidos:
        pid = mapa_pedidos.get(p["legado_id"])
        if not pid:
            continue
        for i in p["itens"]:
            mod = (i.get("produto_modelo") or "").strip()
            tit = (i.get("produto_titulo") or "").strip()
            itens.append({
                "pedido_id": pid,
                "produto_id": produtos.get((mod, tit)) or produtos.get(mod),
                "produto_titulo": tit or "(sem descrição)",
                "produto_modelo": mod or "—",
                "tamanho": i.get("tamanho"),
                "pecas_no_kit": max(1, int(i.get("pecas_no_kit") or 1)),
                "qtd_kits": max(1, int(i.get("qtd_kits") or 1)),
                "preco_kit_atacado": i.get("preco_kit_atacado") or 0,
                "preco_kit_varejo": i.get("preco_kit_varejo") or 0,
            })

    log(f"  itens: {len(itens)}")
    # pedido_itens não tem legado_id; inserimos direto, sem upsert
    for i in range(0, len(itens), LOTE):
        lote = itens[i:i + LOTE]
        r = S.post(f"{URL}/rest/v1/pedido_itens",
                   headers={"Prefer": "return=minimal"},
                   data=json.dumps(lote), timeout=180)
        if r.status_code >= 300:
            raise SystemExit(f"FALHA em pedido_itens (HTTP {r.status_code}): {r.text[:700]}")
        if (i // LOTE) % 10 == 9:
            log(f"    {min(i + LOTE, len(itens))}/{len(itens)}")

    ligados = sum(1 for i in itens if i["produto_id"])
    log(f"  {ligados} de {len(itens)} itens ligados a um produto do catálogo")
    return pedidos


# ---------------------------------------------------------------------- conferir

def conferir(pedidos_legado):
    log("Conferindo totais contra o sistema antigo...")
    r = S.get(f"{URL}/rest/v1/pedidos?select=legado_id,numero,total_atacado,total_varejo",
              timeout=180)
    banco = {p["legado_id"]: p for p in r.json()}

    difs = []
    for p in pedidos_legado:
        b = banco.get(p["legado_id"])
        if not b:
            continue
        for campo in ("total_atacado", "total_varejo"):
            velho = float(p.get(campo) or 0)
            novo = float(b.get(campo) or 0)
            if abs(velho - novo) > 0.05:
                difs.append((p["numero"], campo, velho, novo))

    if difs:
        log(f"  {len(difs)} divergências de total:")
        for d in difs[:10]:
            log(f"    pedido {d[0]} · {d[1]}: legado {d[2]:.2f} vs novo {d[3]:.2f}")
    else:
        log(f"  todos os {len(pedidos_legado)} pedidos batem com o legado")


def main():
    alvo = sys.argv[1] if len(sys.argv) > 1 else "tudo"
    inicio = time.time()

    mapa = {}
    if alvo in ("tudo", "clientes", "pedidos"):
        mapa = importar_clientes()

    if alvo in ("tudo", "pedidos"):
        pedidos = importar_pedidos(mapa)
        conferir(pedidos)

    log(f"FIM em {(time.time() - inicio) / 60:.1f} min")


if __name__ == "__main__":
    main()

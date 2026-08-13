#!/usr/bin/env python3
"""
Limpa as descrições de produto herdadas do sistema antigo.

O PHP guardava a descrição como pedaço de HTML, então o texto chegou aqui com
entidades cruas: 1.239 `&nbsp;`, além de `&quot;`, `&reg;`, `&ndash;`. Exibido
no catálogo, o lojista leria "elástico personalizado &nbsp; Características".

O `&nbsp;` isolado entre dois trechos não era enfeite: era o parágrafo em
branco que separava a apresentação do produto da ficha técnica. Por isso ele
vira quebra de parágrafo, e não um ponto final inventado.

Uso:
    python3 scripts/limpar_descricoes.py            # ensaio, não grava nada
    python3 scripts/limpar_descricoes.py --aplicar  # grava, com backup antes
"""

import html
import json
import os
import re
import sys
import urllib.request
from datetime import datetime

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP = os.path.join(RAIZ, "db", "migracao", "backup-descricoes")

# Títulos de seção usados pelo cadastro antigo.
SECOES = ("Características", "Composição", "Caracteristicas", "Composicao")


def ambiente():
    env = {}
    with open(os.path.join(RAIZ, ".env.local")) as f:
        for linha in f:
            if "=" in linha:
                chave, valor = linha.split("=", 1)
                env[chave.strip()] = valor.strip()
    return env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]


def pedir(api, chave, caminho, metodo="GET", corpo=None, prefer=None):
    cabecalho = {
        "apikey": chave,
        "Authorization": f"Bearer {chave}",
        "Content-Type": "application/json",
    }
    if prefer:
        cabecalho["Prefer"] = prefer
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(
        f"{api}/rest/v1/{caminho}", data=dados, headers=cabecalho, method=metodo
    )
    with urllib.request.urlopen(req) as resp:
        texto = resp.read().decode()
        return json.loads(texto) if texto.strip() else None


def limpar(bruto):
    """Devolve a descrição legível, ou None se não sobrar texto."""
    if not bruto:
        return None

    texto = html.unescape(bruto)          # &nbsp; -> \xa0, &quot; -> " ...
    texto = texto.replace("\xa0", " ")    # espaço duro vira espaço comum
    texto = re.sub(r"<[^>]+>", " ", texto)  # nenhuma tag hoje, mas não custa

    # O separador de parágrafo virou uma sequência de espaços. Onde ela
    # antecede um título de seção, devolvemos a quebra que existia no original.
    for secao in SECOES:
        texto = re.sub(rf"\s{{2,}}{secao}\b", f"\n\n{secao}", texto)

    # "Características 94% Poliamida" -> "Características: 94% Poliamida".
    # Parte das fichas já tinha os dois pontos; o \b evita duplicá-los.
    for secao in SECOES:
        texto = re.sub(rf"^({secao})(?!\s*:)\s*", r"\1: ", texto, flags=re.M)

    texto = re.sub(r"[ \t]+", " ", texto)          # espaços repetidos
    texto = re.sub(r" *\n *", "\n", texto)         # espaço colado na quebra
    texto = re.sub(r"\n{3,}", "\n\n", texto)       # no máximo um branco
    texto = texto.strip()

    return texto or None


def main():
    aplicar = "--aplicar" in sys.argv
    api, chave = ambiente()

    produtos = pedir(api, chave, "produtos?select=id,modelo,descricao&limit=2000")
    mudam = []
    for p in produtos:
        novo = limpar(p.get("descricao"))
        if novo != p.get("descricao"):
            mudam.append((p, novo))

    print(f"produtos: {len(produtos)} · descrições que mudam: {len(mudam)}")

    if not aplicar:
        print("\n--- ENSAIO (nada foi gravado) ---")
        for p, novo in mudam[:5]:
            print(f"\n[ref {p['modelo']}]")
            print(f"  antes:  {p['descricao'][:160]!r}")
            print(f"  depois: {novo[:160]!r}")
        # Rede de segurança: nenhuma limpeza pode apagar o texto.
        vazios = [p["modelo"] for p, novo in mudam if not novo]
        print(f"\ndescrições que ficariam vazias: {len(vazios)} {vazios[:5]}")
        print("\nrode com --aplicar para gravar")
        return

    if not mudam:
        print("nada a fazer")
        return

    os.makedirs(BACKUP, exist_ok=True)
    carimbo = datetime.now().strftime("%Y%m%d-%H%M%S")
    caminho = os.path.join(BACKUP, f"descricoes-{carimbo}.json")
    with open(caminho, "w", encoding="utf8") as f:
        json.dump(
            [{"id": p["id"], "modelo": p["modelo"], "descricao": p["descricao"]}
             for p, _ in mudam],
            f, ensure_ascii=False, indent=1,
        )
    print(f"backup: {caminho}")

    for i, (p, novo) in enumerate(mudam, 1):
        pedir(api, chave, f"produtos?id=eq.{p['id']}", "PATCH",
              {"descricao": novo}, prefer="return=minimal")
        if i % 100 == 0:
            print(f"  {i}/{len(mudam)}")

    print(f"pronto: {len(mudam)} descrições limpas")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Importa o catálogo extraído do sistema antigo para o Supabase.

Escopo: fabricantes, categorias, subcategorias, tamanhos, embalagens,
produtos, variações de tamanho e imagens.
NÃO importa clientes nem pedidos — ficam para uma segunda etapa.

É idempotente: roda quantas vezes quiser. Cada tabela tem `legado_id` único e
a importação usa upsert por esse campo, então reexecutar atualiza em vez de
duplicar.

Uso:
    python3 scripts/importar_catalogo.py           # tudo
    python3 scripts/importar_catalogo.py imagens   # só as fotos
"""
import io
import json
import os
import re
import sys
import time
import unicodedata
from collections import Counter

import requests
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEGADO = os.path.join(RAIZ, "db", "migracao", "legado")
IMAGENS = os.path.join(LEGADO, "imagens")

# Imagens: 1600px de lado maior cobre bem telas grandes sem inflar o arquivo.
# WebP em 82 mantém a qualidade visual e corta ~70% do peso do JPEG original.
LARGURA_MAX = 1600
QUALIDADE = 82
LOTE = 200


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def carrega_env():
    env = {}
    with open(os.path.join(RAIZ, ".env.local"), encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                k, v = linha.split("=", 1)
                env[k.strip()] = v.strip()
    if not env.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY ausente no .env.local")
    return env


ENV = carrega_env()
URL = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]

S = requests.Session()
S.headers.update({
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
})


def upsert(tabela, linhas, conflito="legado_id"):
    """Insere em lotes, atualizando quem já existe. Devolve as linhas gravadas."""
    if not linhas:
        return []
    saida = []
    for i in range(0, len(linhas), LOTE):
        lote = linhas[i:i + LOTE]
        r = S.post(
            f"{URL}/rest/v1/{tabela}?on_conflict={conflito}",
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            data=json.dumps(lote), timeout=120,
        )
        if r.status_code >= 300:
            raise SystemExit(f"FALHA em {tabela} (HTTP {r.status_code}): {r.text[:600]}")
        saida += r.json()
    log(f"  {tabela}: {len(saida)} registros")
    return saida


def J(nome):
    with open(os.path.join(LEGADO, nome), encoding="utf-8") as f:
        return json.load(f)


def L(nome):
    with open(os.path.join(LEGADO, nome), encoding="utf-8") as f:
        return [json.loads(l) for l in f]


def slug(v):
    v = unicodedata.normalize("NFKD", v or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", v).strip("-").lower() or "sem-nome"


def mapa(linhas):
    """legado_id -> id novo"""
    return {r["legado_id"]: r["id"] for r in linhas if r.get("legado_id") is not None}


# ------------------------------------------------------------- tabelas de apoio

def importar_apoio():
    log("Tabelas de apoio...")

    fab = upsert("fabricantes", [{
        "legado_id": f["legado_id"], "nome": f["titulo"].strip(),
        "slug": slug(f["titulo"]), "descricao": f.get("descricao") or None,
        "ordem": int(f.get("ordem") or 0), "ativo": f["ativo"],
    } for f in J("fabricantes.json")])

    cat = upsert("categorias", [{
        "legado_id": c["legado_id"], "nome": c["titulo"].strip(),
        "slug": slug(c["titulo"]), "descricao": c.get("descricao") or None,
        "ordem": int(c.get("ordem") or 0), "ativo": c["ativo"],
    } for c in J("categorias.json")])
    m_cat = mapa(cat)

    # No legado a subcategoria vem como "Categoria > Título"; o nome real é o
    # que está depois do ">".
    subs = []
    for s in J("subcategorias.json"):
        pai = (s.get("categoria") or "").strip()
        id_pai = next((c["id"] for c in cat if c["nome"] == pai), None)
        if id_pai is None:
            log(f"  AVISO: subcategoria '{s['titulo']}' sem categoria '{pai}'; ignorada")
            continue
        subs.append({
            "legado_id": s["legado_id"], "categoria_id": id_pai,
            "nome": s["titulo"].strip(), "slug": slug(s["titulo"]),
            "descricao": s.get("descricao") or None,
            "ordem": int(s.get("ordem") or 0), "ativo": s["ativo"],
        })
    m_sub = mapa(upsert("subcategorias", subs))

    emb = upsert("embalagens", [{
        "legado_id": e["legado_id"], "pecas": e["pecas"],
        "descricao": e["descricao"], "ordem": e["ordem"], "ativo": e["ativo"],
    } for e in J("embalagens.json")])

    # tipo vem da classificação revisável em db/migracao/tamanhos.csv
    tipos = {}
    csv_path = os.path.join(RAIZ, "db", "migracao", "tamanhos.csv")
    if os.path.exists(csv_path):
        import csv
        with open(csv_path, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                # a coluna `corrigir_para` permite ao humano sobrepor a sugestão
                tipos[int(r["legado_id"])] = (r.get("corrigir_para") or "").strip() \
                                             or r["tipo_sugerido"]

    tam = upsert("tamanhos", [{
        "legado_id": t["legado_id"], "valor": t["valor"].strip(),
        "tipo": tipos.get(t["legado_id"], "tamanho"),
        "ordem": t["ordem"], "ativo": True,
    } for t in J("tamanhos.json")])

    return {"cat": m_cat, "sub": m_sub, "fab": mapa(fab),
            "emb": mapa(emb), "tam": mapa(tam)}


# ---------------------------------------------------------------------- produtos

def importar_produtos(m):
    prods = L("produtos.jsonl")
    log(f"Produtos: {len(prods)}")

    # Desempata os slugs que colidem, acrescentando o ID do legado. Sem isso o
    # banco recusa o segundo produto com o mesmo slug.
    contagem = Counter(p["slug"] for p in prods)
    usados = set()
    for p in prods:
        s = p["slug"]
        if contagem[s] > 1 or s in usados:
            s = f"{s}-{p['legado_id']}"
        usados.add(s)
        p["slug_final"] = s

    linhas = [{
        "legado_id": p["legado_id"],
        "categoria_id": m["cat"][p["categoria_legado_id"]],
        "subcategoria_id": m["sub"].get(p["subcategoria_legado_id"]),
        "fabricante_id": m["fab"].get(p["fabricante_legado_id"]),
        "embalagem_id": m["emb"][p["embalagem_legado_id"]],
        "modelo": p["modelo"], "titulo": p["titulo"], "slug": p["slug_final"],
        "descricao": p.get("descricao"), "tags": p.get("tags") or [],
        "preco_atacado": p["preco_pacote_atacado"] or 0,
        "preco_varejo": p["preco_pacote_varejo"] or 0,
        "ncm": p.get("ncm"), "possui_st": p["possui_st"],
        "ativo": p["ativo"], "lancamento": p["lancamento"],
    } for p in prods]

    m_prod = mapa(upsert("produtos", linhas))

    variacoes = [{
        "legado_id": t["legado_id"],
        "produto_id": m_prod[p["legado_id"]],
        "tamanho_id": m["tam"][t["tamanho_legado_id"]],
        # 0.00 no legado significa "herda do produto"; aqui vira NULL explícito
        "preco_atacado": t["preco_pacote_atacado"],
        "preco_varejo": t["preco_pacote_varejo"],
        "ncm": t.get("ncm"), "ativo": True,
    } for p in prods for t in p["tamanhos"]]
    upsert("produto_tamanhos", variacoes)

    return m_prod, prods


# ---------------------------------------------------------------------- imagens

def converter(caminho):
    """JPEG/PNG original -> WebP redimensionado. Devolve os bytes."""
    with Image.open(caminho) as im:
        if im.mode in ("RGBA", "LA", "P"):
            fundo = Image.new("RGB", im.size, (255, 255, 255))
            im = im.convert("RGBA")
            fundo.paste(im, mask=im.split()[-1])
            im = fundo
        else:
            im = im.convert("RGB")
        if max(im.size) > LARGURA_MAX:
            im.thumbnail((LARGURA_MAX, LARGURA_MAX), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=QUALIDADE, method=6)
        return buf.getvalue()


def importar_imagens(m_prod, prods):
    log(f"Imagens: {len(prods)} produtos")
    registros, enviados, pulados, falhas = [], 0, 0, []
    economia_de, economia_para = 0, 0

    for n, p in enumerate(prods, 1):
        if not p.get("imagens"):
            continue
        origem = os.path.join(IMAGENS, p["imagens"][0])
        if not os.path.exists(origem):
            falhas.append((p["legado_id"], "arquivo ausente"))
            continue

        destino = f"{p['slug_final']}.webp"
        try:
            dados = converter(origem)
            economia_de += os.path.getsize(origem)
            economia_para += len(dados)

            r = S.post(
                f"{URL}/storage/v1/object/produtos/{destino}",
                headers={"Authorization": f"Bearer {KEY}", "apikey": KEY,
                         "Content-Type": "image/webp",
                         "x-upsert": "true"},
                data=dados, timeout=120,
            )
            if r.status_code >= 300:
                falhas.append((p["legado_id"], f"upload HTTP {r.status_code}"))
                continue
            enviados += 1
            registros.append({
                "produto_id": m_prod[p["legado_id"]],
                "storage_path": destino,
                "alt": f"{p['titulo']} {p['modelo']}".strip(),
                "ordem": 0, "principal": True,
                "legado_url": f"https://comercialgale.com.br/arquivos/produto/{p['imagens'][0]}",
            })
        except Exception as e:
            falhas.append((p["legado_id"], str(e)[:80]))
        if n % 100 == 0:
            log(f"  {n}/{len(prods)}")

    # produto_imagens não tem legado_id; o conflito é produto_id+principal
    if registros:
        for i in range(0, len(registros), LOTE):
            lote = registros[i:i + LOTE]
            r = S.post(f"{URL}/rest/v1/produto_imagens",
                       headers={"Prefer": "return=minimal"},
                       data=json.dumps(lote), timeout=120)
            if r.status_code >= 300:
                log(f"  FALHA ao gravar produto_imagens: {r.text[:300]}")
        log(f"  produto_imagens: {len(registros)} registros")

    if economia_de:
        log(f"  peso: {economia_de/1e6:.1f} MB -> {economia_para/1e6:.1f} MB "
            f"({100 - economia_para*100/economia_de:.0f}% menor)")
    log(f"  enviadas {enviados} | pulados {pulados} | falhas {len(falhas)}")
    for f in falhas[:10]:
        log(f"    {f}")
    return falhas


# -------------------------------------------------------------------------- main

def main():
    alvo = sys.argv[1] if len(sys.argv) > 1 else "tudo"
    inicio = time.time()

    m = importar_apoio()
    m_prod, prods = importar_produtos(m)

    if alvo in ("tudo", "imagens"):
        # slug_final é calculado em importar_produtos; se rodar só imagens,
        # os produtos já foram (re)importados acima de qualquer forma.
        importar_imagens(m_prod, prods)

    log("=" * 60)
    log(f"FIM em {(time.time()-inicio)/60:.1f} min")


if __name__ == "__main__":
    main()

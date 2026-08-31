#!/usr/bin/env python3
"""
Importa o catálogo extraído do sistema antigo para o Supabase.

Escopo: fabricantes, categorias, subcategorias, tamanhos, kits,
produtos, variações de tamanho e imagens.
NÃO importa clientes nem pedidos — ficam para uma segunda etapa.

É idempotente: roda quantas vezes quiser. Cada tabela tem `legado_id` único e
a importação usa upsert por esse campo, então reexecutar atualiza em vez de
duplicar.

Uso:
    python3 scripts/importar_catalogo.py           # tudo
    python3 scripts/importar_catalogo.py imagens   # só as fotos
"""
import hashlib
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

# Uma única definição da regra de limpeza, compartilhada com o script que
# corrigiu as descrições já importadas.
from limpar_descricoes import limpar as limpar_descricao

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

    kits = upsert("kits", [{
        "legado_id": e["legado_id"], "pecas": e["pecas"],
        "descricao": e["descricao"], "ordem": e["ordem"], "ativo": e["ativo"],
    } for e in J("kits.json")])

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
            "kit": mapa(kits), "tam": mapa(tam)}


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
        "kit_id": m["kit"][p["kit_legado_id"]],
        "modelo": p["modelo"], "titulo": p["titulo"], "slug": p["slug_final"],
        # O legado guarda a descrição como HTML e ela chega com `&nbsp;` cru;
        # a mesma regra usada em limpar_descricoes.py deixa o texto legível.
        "descricao": limpar_descricao(p.get("descricao")),
        "tags": p.get("tags") or [],
        "preco_atacado": p["preco_kit_atacado"] or 0,
        "preco_varejo": p["preco_kit_varejo"] or 0,
        "ncm": p.get("ncm"), "possui_st": p["possui_st"],
        "ativo": p["ativo"], "lancamento": p["lancamento"],
    } for p in prods]

    m_prod = mapa(upsert("produtos", linhas))

    variacoes = [{
        "legado_id": t["legado_id"],
        "produto_id": m_prod[p["legado_id"]],
        "tamanho_id": m["tam"][t["tamanho_legado_id"]],
        # 0.00 no legado significa "herda do produto"; aqui vira NULL explícito
        "preco_atacado": t["preco_kit_atacado"],
        "preco_varejo": t["preco_kit_varejo"],
        "ncm": t.get("ncm"), "ativo": True,
    } for p in prods for t in p["tamanhos"]]
    upsert("produto_tamanhos", variacoes)

    return m_prod, prods


# ---------------------------------------------------------------------- imagens

def eh_imagem(dados):
    """Número mágico do arquivo. Mesma checagem do extrator — ver o comentário
    lá: o servidor antigo responde 200 com HTML quando o arquivo não existe."""
    return (
        dados.startswith(b"\xff\xd8\xff")
        or dados.startswith(b"\x89PNG\r\n\x1a\n")
        or dados.startswith(b"GIF8")
        or (dados[:4] == b"RIFF" and dados[8:12] == b"WEBP")
    )


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


def imagens_existentes(produto_ids):
    """
    O que cada produto já tem em `produto_imagens`.

    A chave de idempotência é o `legado_url` — a URL de origem no site antigo —
    e NÃO a posição da foto na lista. A diferença não é acadêmica: em 5
    produtos a principal em produção veio de um `...-(1).jpg` que o legado
    apagou depois, e todas as fotos da galeria são novas. Numerar por posição
    faria a primeira colidir com o `{slug}.webp` que já existe, e essa foto
    seria silenciosamente descartada.
    """
    info, passo = {}, 500
    ids = list(produto_ids)
    for i in range(0, len(ids), passo):
        lote = ids[i:i + passo]
        r = S.get(
            f"{URL}/rest/v1/produto_imagens",
            params={"select": "produto_id,storage_path,legado_url,ordem,principal",
                    "produto_id": f"in.({','.join(str(x) for x in lote)})"},
            timeout=120,
        )
        if r.status_code >= 300:
            raise SystemExit(f"não consegui ler produto_imagens: {r.text[:200]}")
        for linha in r.json():
            d = info.setdefault(linha["produto_id"],
                                {"urls": set(), "paths": set(),
                                 "tem_principal": False, "ordem": -1})
            if linha.get("legado_url"):
                d["urls"].add(linha["legado_url"])
            d["paths"].add(linha["storage_path"])
            d["tem_principal"] |= bool(linha["principal"])
            d["ordem"] = max(d["ordem"], linha["ordem"])
    return info


def importar_imagens(m_prod, prods):
    """
    Sobe TODAS as fotos de cada produto, não só a primeira.

    A versão anterior fazia `p["imagens"][0]` e gravava sempre em
    `{slug}.webp` — um nome fixo por produto. Além de descartar a galeria,
    o nome fixo faria as fotos se sobrescreverem se alguém tentasse subir
    mais de uma. Agora a primeira mantém `{slug}.webp` (é a que já está em
    produção, e o caminho não muda) e as demais viram `{slug}-2.webp`,
    `{slug}-3.webp`…

    Idempotente: consulta o que já existe em `produto_imagens` e só insere o
    que falta, então dá para rodar de novo sem duplicar nada.
    """
    log(f"Imagens: {len(prods)} produtos")
    registros, enviados, repetidas, falhas = [], 0, 0, []
    economia_de, economia_para = 0, 0

    existentes = imagens_existentes(set(m_prod.values()))
    vazio = {"urls": set(), "paths": set(), "tem_principal": False, "ordem": -1}

    for n, p in enumerate(prods, 1):
        if not p.get("imagens"):
            continue
        produto_id = m_prod[p["legado_id"]]
        info = existentes.setdefault(produto_id, dict(vazio, urls=set(), paths=set()))
        vistos = set()   # hash do original, dentro do mesmo produto
        slot = 1

        for relativo in p["imagens"]:
            legado_url = f"https://comercialgale.com.br/arquivos/{relativo}"
            if legado_url in info["urls"]:
                continue   # já importada numa execução anterior

            origem = os.path.join(IMAGENS, relativo)
            if not os.path.exists(origem):
                falhas.append((p["legado_id"], f"ausente: {relativo}"))
                continue

            with open(origem, "rb") as fh:
                bruto = fh.read()
            if not eh_imagem(bruto):
                # o legado devolve 200 com HTML para arquivo inexistente;
                # se um desses escapou para o disco, ele morre aqui
                falhas.append((p["legado_id"], f"não é imagem: {relativo}"))
                continue
            digest = hashlib.md5(bruto).hexdigest()
            if digest in vistos:
                repetidas += 1
                continue   # mesma foto servida em dois caminhos
            vistos.add(digest)

            # primeiro nome livre: nunca sobrescreve o que já está no ar
            while True:
                destino = f"{p['slug_final']}.webp" if slot == 1 else f"{p['slug_final']}-{slot}.webp"
                if destino not in info["paths"]:
                    break
                slot += 1

            try:
                dados = converter(origem)
                economia_de += len(bruto)
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
                info["ordem"] += 1
                info["paths"].add(destino)
                info["urls"].add(legado_url)
                # produto_imagens_principal_uniq admite UMA principal por
                # produto: só assume quem chega e não encontra nenhuma
                principal = not info["tem_principal"]
                info["tem_principal"] = True
                registros.append({
                    "produto_id": produto_id,
                    "storage_path": destino,
                    "alt": f"{p['titulo']} {p['modelo']}".strip(),
                    "ordem": info["ordem"],
                    "principal": principal,
                    "legado_url": legado_url,
                })
            except Exception as e:
                falhas.append((p["legado_id"], str(e)[:80]))
        if n % 100 == 0:
            log(f"  {n}/{len(prods)} produtos · {enviados} fotos enviadas")

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
    log(f"  enviadas {enviados} | duplicadas ignoradas {repetidas} | falhas {len(falhas)}")
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

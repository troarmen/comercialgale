#!/usr/bin/env python3
"""
Extrai todos os dados do painel antigo da Galé (comercialgale.com.br/admin)
para arquivos JSON locais, prontos para importar no Supabase.

SOMENTE LEITURA. O único POST que não é consulta é o de login.

Uso:
    python3 scripts/extrair_legado.py            # extrai tudo (retoma de onde parou)
    python3 scripts/extrair_legado.py produtos   # só um módulo

Saída em db/migracao/legado/:
    fabricantes.json  categorias.json  subcategorias.json
    tamanhos.json     kits.json  caracteristicas.json
    produtos.jsonl    clientes.jsonl   pedidos.jsonl
    imagens/          (fotos originais)
    relatorio.json    (contagens e falhas)
"""
import json
import os
import re
import sys
import time
import unicodedata
from urllib.parse import quote

import requests

BASE = "https://comercialgale.com.br"
LOGIN = "admin"
SENHA = "Arthur2303"

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "db", "migracao", "legado")
IMAGENS = os.path.join(SAIDA, "imagens")

# Intervalo entre requisições. O servidor antigo é lento e é o site de produção
# do cliente — não vale a pena acelerar e arriscar derrubar o pedido de alguém.
PAUSA = 0.35
TIMEOUT = 60
TENTATIVAS = 3


# ---------------------------------------------------------------- infraestrutura

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


class Painel:
    """Sessão autenticada no painel antigo, com relogin automático."""

    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": f"{BASE}/admin/",
        })
        self.entrar()

    def entrar(self):
        self.s.cookies.clear()
        self.s.get(f"{BASE}/admin/", timeout=TIMEOUT)
        r = self.s.post(
            f"{BASE}/controller/sistema/usuarios/login",
            data={"mode": "LOGIN", "login": LOGIN, "password": SENHA},
            timeout=TIMEOUT,
        )
        if "location.reload" not in r.text:
            raise SystemExit(f"Falha no login. Resposta: {r.text[:300]}")
        log("Sessão autenticada.")

    def post(self, caminho, dados, espera=None):
        """POST com retentativa e relogin se a sessão cair."""
        for tentativa in range(1, TENTATIVAS + 1):
            try:
                r = self.s.post(f"{BASE}{caminho}", data=dados, timeout=TIMEOUT)
                texto = r.text
                # sessão expirada devolve a tela de login
                if "Digite o Login" in texto and "password" in texto:
                    log("Sessão expirou; reautenticando.")
                    self.entrar()
                    continue
                if espera and espera not in texto:
                    raise ValueError(f"resposta inesperada ({len(texto)} bytes)")
                return texto
            except Exception as e:
                if tentativa == TENTATIVAS:
                    raise
                espera_s = 2 ** tentativa
                log(f"  erro em {caminho} ({e}); nova tentativa em {espera_s}s")
                time.sleep(espera_s)
        return ""

    def publica(self, pid):
        """
        Ficha pública do produto. É a única tela que lista a galeria — o
        formulário do admin traz só a foto principal. O slug na URL é
        decorativo: o legado resolve tudo pelo ID.
        """
        for tentativa in range(1, TENTATIVAS + 1):
            try:
                r = self.s.get(f"{BASE}/produto/{pid}/x", timeout=TIMEOUT)
                # o legado serve a página em latin-1 mas declara utf-8
                return r.content.decode("latin-1", "replace")
            except Exception as e:
                if tentativa == TENTATIVAS:
                    log(f"  ficha pública {pid} falhou ({e}); segue só com o admin")
                    return ""
                time.sleep(2 ** tentativa)
        return ""

    def grid(self, caminho, total=None):
        """Lê um DataTable server-side inteiro."""
        if total is None:
            j = json.loads(self.post(caminho, {"draw": 1, "start": 0, "length": 1}))
            total = int(j["recordsTotal"])
        j = json.loads(self.post(caminho, {"draw": 1, "start": 0, "length": total}))
        return j["data"]


# ------------------------------------------------------------------- utilidades

def texto_limpo(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def slug(valor):
    v = unicodedata.normalize("NFKD", valor or "").encode("ascii", "ignore").decode()
    v = re.sub(r"[^a-zA-Z0-9]+", "-", v).strip("-").lower()
    return v or "sem-nome"


def campos(html):
    """Todos os inputs/textarea/select do formulário -> {nome: valor}."""
    dados = {}

    def guarda(nome, valor):
        # o form de cliente repete 'nome'/'documento' nos blocos PF e PJ;
        # o primeiro valor não-vazio é o que vale
        if nome not in dados or (not dados[nome] and valor):
            dados[nome] = valor

    for m in re.finditer(r"<input[^>]*>", html):
        tag = m.group(0)
        n = re.search(r"name=['\"]([^'\"]+)['\"]", tag)
        v = re.search(r"value=['\"]([^'\"]*)['\"]", tag)
        if n and "[" not in n.group(1):
            guarda(n.group(1), (v.group(1) if v else "").strip())

    for m in re.finditer(r"<textarea[^>]*name=['\"]([^'\"]+)['\"][^>]*>(.*?)</textarea>", html, re.S):
        guarda(m.group(1), texto_limpo(m.group(2)))

    for m in re.finditer(r"<select[^>]*name=['\"]([^'\"\[]+)['\"][^>]*>(.*?)</select>", html, re.S):
        nome, corpo = m.group(1), m.group(2)
        sel = re.findall(r"<option value=['\"]([^'\"]*)['\"][^>]*\bselected\b[^>]*>([^<]*)</option>", corpo)
        # o legado marca "Selecione" como selected também; fica o último real
        reais = [(v, t.strip()) for v, t in sel if v]
        if reais:
            guarda(nome, reais[-1][0])
            guarda(nome + "_label", reais[-1][1])
        else:
            guarda(nome, "")
    return dados


def eh_imagem(dados):
    """
    O servidor antigo NÃO devolve 404: para arquivo inexistente ele responde
    200 com a página HTML do site. Checar o status é insuficiente — a única
    prova é o número mágico do início do arquivo.
    """
    return (
        dados.startswith(b"\xff\xd8\xff")                       # JPEG
        or dados.startswith(b"\x89PNG\r\n\x1a\n")               # PNG
        or dados.startswith(b"GIF8")                            # GIF
        or (dados[:4] == b"RIFF" and dados[8:12] == b"WEBP")    # WebP
    )


def dinheiro(v):
    """'1.234,56' ou '1234.56' -> float"""
    if v is None or v == "":
        return None
    v = str(v).strip()
    if "," in v:
        v = v.replace(".", "").replace(",", ".")
    try:
        return round(float(v), 2)
    except ValueError:
        return None


# ------------------------------------------------------------------ persistência

def carrega_feitos(caminho):
    """IDs já extraídos, para retomar sem refazer trabalho."""
    if not os.path.exists(caminho):
        return set()
    feitos = set()
    with open(caminho, encoding="utf-8") as f:
        for linha in f:
            try:
                feitos.add(str(json.loads(linha)["legado_id"]))
            except Exception:
                pass
    return feitos


def grava(caminho, registro):
    with open(caminho, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro, ensure_ascii=False) + "\n")


def grava_json(nome, dados):
    caminho = os.path.join(SAIDA, nome)
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    log(f"  -> {nome} ({len(dados)} registros)")


# ------------------------------------------------------------ tabelas de apoio

def extrair_apoio(p):
    log("Tabelas de apoio...")

    def simples(caminho, chaves=("TITULO", "DESCRICAO", "ORDEM")):
        saida = []
        for r in p.grid(caminho):
            reg = {"legado_id": int(r["ID"]), "ativo": r.get("DT_RowStatus") == "1"}
            for k in chaves:
                if k in r:
                    reg[k.lower()] = texto_limpo(str(r[k]))
            saida.append(reg)
            time.sleep(0)
        return saida

    fab = simples("/controller/produto/fabricante/grid")
    for f in fab:
        f["slug"] = slug(f["titulo"])
    grava_json("fabricantes.json", fab)

    cat = simples("/controller/produto/categoria/grid")
    for c in cat:
        c["slug"] = slug(c["titulo"])
    grava_json("categorias.json", cat)

    sub = simples("/controller/produto/subcategoria/grid", ("TITULO", "DESCRICAO", "ORDEM", "CATEGORIA"))
    for s in sub:
        s["slug"] = slug(s["titulo"])
    grava_json("subcategorias.json", sub)

    grava_json("caracteristicas.json", simples("/controller/produto/caracteristica/grid"))

    emb = []
    for r in p.grid("/controller/produto/unidade/grid"):
        emb.append({
            "legado_id": int(r["ID"]),
            "pecas": int(re.sub(r"\D", "", str(r["SIGLA"])) or 0),
            "descricao": texto_limpo(str(r["TITULO"])),
            "ordem": int(r.get("ORDEM") or 0),
            "ativo": r.get("DT_RowStatus") == "1",
        })
    grava_json("kits.json", emb)

    # tamanhos: a lista completa só existe dentro do <select> do cadastro de produto
    ids = [r["ID"] for r in p.grid("/controller/produto/grid")]
    html = p.post("/controller/produto/cadastro", {"id": ids[0], "m": "produto"})
    bloco = re.search(r'<select name="opcao\[46\]\[\]">(.*?)</select>', html, re.S)
    tamanhos = [
        {"legado_id": int(v), "valor": t.strip(), "ordem": i}
        for i, (v, t) in enumerate(re.findall(r"<option value=\"(\d+)\">([^<]*)</option>", bloco.group(1)))
    ]
    grava_json("tamanhos.json", tamanhos)
    return ids


# ---------------------------------------------------------------------- produtos

def fotos_do_produto(p, pid, html_admin):
    """
    Todas as fotos de um produto, em ordem, como caminhos relativos:
        produto/nome.jpg          -> a principal
        galeria/1691/nome.jpg     -> as demais

    O formulário do admin mostra SÓ a principal: o campo é um único
    `<input type="file" name="imagem">`. A galeria existe apenas na ficha
    PÚBLICA, num diretório separado (`/arquivos/galeria/<id>/`), e foi por isso
    que a primeira extração trouxe uma foto por produto — ela só olhava o
    admin, e só o prefixo `arquivos/produto/`.

    A principal costuma aparecer repetida dentro da galeria; a comparação é
    pelo nome do arquivo, e a de `produto/` sempre vem primeiro.
    """
    def achar(texto):
        return re.findall(r"arquivos/(produto|galeria/\d+)/((?:thumb/)?[^\"']+?)[\"']", texto)

    principal, galeria = [], []
    for origem in (html_admin, p.publica(pid)):
        for pasta, arquivo in achar(origem):
            if arquivo.lower().startswith("thumb"):
                continue  # miniatura do mesmo arquivo, não é outra foto
            (principal if pasta == "produto" else galeria).append(f"{pasta}/{arquivo}")

    principal = list(dict.fromkeys(principal))
    vistos = {os.path.basename(c) for c in principal}
    saida = list(principal)
    for c in dict.fromkeys(galeria):
        if os.path.basename(c) not in vistos:
            vistos.add(os.path.basename(c))
            saida.append(c)
    return saida


def variacoes_do_html(html):
    i = html.find("OPCOES SALVAS")
    if i < 0:
        return []
    saida = []
    for linha in re.split(r"<tr>", html[i:]):
        m = re.search(r"s_ncm\[(\d+)\]", linha)
        if not m:
            continue
        vid = m.group(1)
        sel = re.search(r'<option value="(\d+)"\s+selected>([^<]*)</option>', linha)
        pa = re.search(r"s_preco_atacado\[\d+\]\"\s+value='([^']*)'", linha)
        pv = re.search(r"s_preco\[\d+\]\"\s+value='([^']*)'", linha)
        ncm = re.search(r"s_ncm\[\d+\]\"\s+value='([^']*)'", linha)
        pa_v, pv_v = dinheiro(pa.group(1) if pa else None), dinheiro(pv.group(1) if pv else None)
        saida.append({
            "legado_id": int(vid),
            "tamanho_legado_id": int(sel.group(1)) if sel else None,
            "tamanho": sel.group(2).strip() if sel else None,
            "ncm": (ncm.group(1) if ncm else "") or None,
            # 0.00 no legado significa "herda do produto", não "de graça"
            "preco_kit_atacado": pa_v if pa_v else None,
            "preco_kit_varejo": pv_v if pv_v else None,
        })
    return saida


def extrair_produtos(p, ids):
    caminho = os.path.join(SAIDA, "produtos.jsonl")
    feitos = carrega_feitos(caminho)
    log(f"Produtos: {len(ids)} no total, {len(feitos)} já extraídos.")

    resumo = {r["ID"]: r for r in p.grid("/controller/produto/grid")}
    falhas = []

    for n, pid in enumerate(ids, 1):
        if str(pid) in feitos:
            continue
        try:
            html = p.post("/controller/produto/cadastro", {"id": pid, "m": "produto"})
            c = campos(html)
            g = resumo.get(pid, {})

            # O <select> de subcategoria vem VAZIO no HTML: é preenchido por
            # AJAX. O valor real está na chamada que o próprio form dispara ao
            # carregar -- loadCategories('<categoria>', '<subcategoria>').
            lc = re.search(r"loadCategories\('(\d*)',\s*'(\d*)'\)", html)
            subcat = int(lc.group(2)) if lc and lc.group(2) else None

            # A ordem importa: a primeira é a principal. Não ordenar por nome —
            # o legado numera as poses do fotógrafo fora de sequência.
            imgs = fotos_do_produto(p, pid, html)

            reg = {
                "legado_id": int(pid),
                "titulo": c.get("titulo", "").strip(),
                "modelo": c.get("modelo", "").strip(),
                "descricao": c.get("descricao") or None,
                "tags": [t.strip() for t in (c.get("tag") or "").split(",") if t.strip()],
                "categoria_legado_id": int(c["categoria"]) if c.get("categoria") else None,
                "subcategoria_legado_id": subcat,
                "fabricante_legado_id": int(c["fabricante"]) if c.get("fabricante") else None,
                "kit_legado_id": int(c["unidade"]) if c.get("unidade") else None,
                # preços do KIT fechado
                "preco_kit_atacado": dinheiro(c.get("preco_atacado")),
                "preco_kit_varejo": dinheiro(c.get("preco")),
                # o legado grava "0" quando o NCM nunca foi preenchido
                "ncm": ((c.get("ncm") or "").strip() or None) if (c.get("ncm") or "").strip() != "0" else None,
                "possui_st": c.get("possui_st") == "1",
                "ativo": g.get("DT_RowStatus") == "1",
                "lancamento": bool(texto_limpo(str(g.get("IS_LANCAMENTO", "")))),
                "data_cadastro": g.get("DATA_CADASTRO"),
                "imagens": imgs,
                "tamanhos": variacoes_do_html(html),
            }
            reg["slug"] = slug(f"{reg['titulo']}-{reg['modelo']}")
            grava(caminho, reg)
        except Exception as e:
            log(f"  FALHA produto {pid}: {e}")
            falhas.append({"tipo": "produto", "id": pid, "erro": str(e)})
        if n % 50 == 0:
            log(f"  produtos {n}/{len(ids)}")
        time.sleep(PAUSA)

    log("Produtos concluídos.")
    return falhas


# ---------------------------------------------------------------------- clientes

def extrair_clientes(p):
    caminho = os.path.join(SAIDA, "clientes.jsonl")
    feitos = carrega_feitos(caminho)
    linhas = p.grid("/controller/clientes/grid")
    log(f"Clientes: {len(linhas)} no total, {len(feitos)} já extraídos.")
    falhas = []

    for n, r in enumerate(linhas, 1):
        cid = r["DT_RowId"].replace("row_", "")
        if cid in feitos:
            continue
        try:
            html = p.post("/controller/clientes/cadastro", {"id": cid, "m": "clientes"})
            c = campos(html)
            reg = {
                "legado_id": int(cid),
                "status_legado": c.get("status"),
                "tipo_pessoa_legado": c.get("tipo_pessoa"),
                "tipo_compra_legado": c.get("tipo_compra"),
                "tipo_cadastro_legado": c.get("tipo_cadastro"),
                "nome": (c.get("nome") or "").strip(),
                "nome_fantasia": (c.get("nome_fantasia") or "").strip() or None,
                "documento": re.sub(r"\D", "", c.get("documento") or "") or None,
                "rg": (c.get("rg") or "").strip() or None,
                "inscricao_estadual": (c.get("IE") or "").strip() or None,
                "data_nascimento": (c.get("data_nasc") or "").strip() or None,
                "email": (c.get("email") or "").strip().lower() or None,
                "telefone1": (c.get("telefone1") or "").strip() or None,
                "telefone2": (c.get("telefone2") or "").strip() or None,
                "telefone3": (c.get("telefone3") or "").strip() or None,
                "nome_contato": (c.get("nome_contato") or "").strip() or None,
                "cep": (c.get("cep") or "").strip() or None,
                "logradouro": (c.get("logradouro") or "").strip() or None,
                "numero": (c.get("numero") or "").strip() or None,
                "complemento": (c.get("complemento") or "").strip() or None,
                "bairro": (c.get("bairro") or "").strip() or None,
                "cidade": (c.get("cidade") or "").strip() or None,
                "uf": (c.get("estado") or "").strip() or None,
                "pais": (c.get("pais") or "").strip() or None,
                "observacoes": (c.get("observacoes") or "").strip() or None,
                "data_cadastro": r.get("DATA_CADASTRO"),
            }
            grava(caminho, reg)
        except Exception as e:
            log(f"  FALHA cliente {cid}: {e}")
            falhas.append({"tipo": "cliente", "id": cid, "erro": str(e)})
        if n % 100 == 0:
            log(f"  clientes {n}/{len(linhas)}")
        time.sleep(PAUSA)

    log("Clientes concluídos.")
    return falhas


# ----------------------------------------------------------------------- pedidos

def itens_do_pedido(html):
    """
    O pedido traz DUAS tabelas com as mesmas linhas: primeiro atacado, depois
    varejo. Cada <tr class="produto"> tem 8 colunas:
      Descrição | Ref. | Tamanho | Kit | Vl Unitário | Qtd | Vl Kit | Total
    """
    blocos = re.findall(r'<tr class="produto">(.*?)</tr>', html, re.S)
    linhas = []
    for b in blocos:
        tds = [texto_limpo(t) for t in re.findall(r"<td[^>]*>(.*?)</td>", b, re.S)]
        if len(tds) >= 8:
            linhas.append(tds)

    metade = len(linhas) // 2
    atacado, varejo = linhas[:metade], linhas[metade:]

    itens = []
    for i, a in enumerate(atacado):
        v = varejo[i] if i < len(varejo) else [None] * 8
        itens.append({
            "produto_titulo": a[0],
            "produto_modelo": a[1],
            "tamanho": a[2] or None,
            "pecas_no_kit": int(a[3] or 1),
            "qtd_kits": int(a[5] or 1),
            "preco_kit_atacado": dinheiro(a[6]),
            "preco_kit_varejo": dinheiro(v[6]) if v[6] else None,
            "total_atacado": dinheiro(a[7]),
            "total_varejo": dinheiro(v[7]) if v[7] else None,
        })
    return itens


def extrair_pedidos(p):
    caminho = os.path.join(SAIDA, "pedidos.jsonl")
    feitos = carrega_feitos(caminho)
    linhas = p.grid("/controller/pedido/grid")
    log(f"Pedidos: {len(linhas)} no total, {len(feitos)} já extraídos.")
    falhas = []

    for n, r in enumerate(linhas, 1):
        oid = r["DT_RowId"].replace("row_", "")
        if oid in feitos:
            continue
        try:
            html = p.post("/controller/pedido/cadastro", {"id": oid, "m": "pedido"})
            c = campos(html)
            reg = {
                "legado_id": int(oid),
                "numero": c.get("venda") or r.get("PEDIDO"),
                "cliente_nome": c.get("cliente") or r.get("NOME"),
                "tipo_pessoa": c.get("tipo_pessoa"),
                "data": c.get("data_cadastro") or r.get("DATA_CADASTRO"),
                "status_legado": r.get("DT_RowStatus"),
                "total_atacado": dinheiro(r.get("TOTAL_ATACADO")),
                "total_varejo": dinheiro(r.get("TOTAL_VAREJO")),
                "itens": itens_do_pedido(html),
            }
            grava(caminho, reg)
        except Exception as e:
            log(f"  FALHA pedido {oid}: {e}")
            falhas.append({"tipo": "pedido", "id": oid, "erro": str(e)})
        if n % 100 == 0:
            log(f"  pedidos {n}/{len(linhas)}")
        time.sleep(PAUSA)

    log("Pedidos concluídos.")
    return falhas


# ----------------------------------------------------------------------- imagens

def baixar_imagens(p):
    os.makedirs(IMAGENS, exist_ok=True)
    arquivo = os.path.join(SAIDA, "produtos.jsonl")
    if not os.path.exists(arquivo):
        log("Sem produtos.jsonl; pulando imagens.")
        return []

    nomes = set()
    with open(arquivo, encoding="utf-8") as f:
        for linha in f:
            nomes.update(json.loads(linha).get("imagens", []))

    log(f"Imagens: {len(nomes)} arquivos únicos.")
    falhas = []
    for n, nome in enumerate(sorted(nomes), 1):
        destino = os.path.join(IMAGENS, nome)
        if os.path.exists(destino) and os.path.getsize(destino) > 0:
            continue
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        # `nome` já vem com a pasta: produto/x.jpg ou galeria/1691/y.jpg
        url = f"{BASE}/arquivos/" + "/".join(quote(parte) for parte in nome.split("/"))
        try:
            r = p.s.get(url, timeout=TIMEOUT)
            if r.status_code != 200 or not r.content:
                falhas.append({"tipo": "imagem", "id": nome, "erro": f"HTTP {r.status_code}"})
            elif not eh_imagem(r.content):
                # ARMADILHA DO LEGADO: arquivo inexistente não devolve 404 —
                # devolve 200 com a página HTML do site. Confiar no status
                # gravaria centenas de páginas HTML renomeadas para .jpg.
                falhas.append({"tipo": "imagem", "id": nome, "erro": "não é imagem (HTML)"})
            else:
                with open(destino, "wb") as f:
                    f.write(r.content)
        except Exception as e:
            falhas.append({"tipo": "imagem", "id": nome, "erro": str(e)})
        if n % 100 == 0:
            log(f"  imagens {n}/{len(nomes)}")
        time.sleep(PAUSA / 2)

    log("Imagens concluídas.")
    return falhas


# -------------------------------------------------------------------------- main

def main():
    os.makedirs(SAIDA, exist_ok=True)
    alvo = sys.argv[1] if len(sys.argv) > 1 else "tudo"
    inicio = time.time()

    p = Painel()
    falhas = []

    ids = extrair_apoio(p)

    if alvo in ("tudo", "produtos"):
        falhas += extrair_produtos(p, ids)
    if alvo in ("tudo", "clientes"):
        falhas += extrair_clientes(p)
    if alvo in ("tudo", "pedidos"):
        falhas += extrair_pedidos(p)
    if alvo in ("tudo", "imagens"):
        falhas += baixar_imagens(p)

    def conta(nome):
        c = os.path.join(SAIDA, nome)
        return sum(1 for _ in open(c, encoding="utf-8")) if os.path.exists(c) else 0

    relatorio = {
        "concluido_em": time.strftime("%Y-%m-%d %H:%M:%S"),
        "duracao_min": round((time.time() - inicio) / 60, 1),
        "produtos": conta("produtos.jsonl"),
        "clientes": conta("clientes.jsonl"),
        "pedidos": conta("pedidos.jsonl"),
        "imagens": len(os.listdir(IMAGENS)) if os.path.isdir(IMAGENS) else 0,
        "falhas": falhas,
    }
    with open(os.path.join(SAIDA, "relatorio.json"), "w", encoding="utf-8") as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=2)

    log("=" * 60)
    log(f"FIM em {relatorio['duracao_min']} min — "
        f"{relatorio['produtos']} produtos, {relatorio['clientes']} clientes, "
        f"{relatorio['pedidos']} pedidos, {relatorio['imagens']} imagens, "
        f"{len(falhas)} falhas")


if __name__ == "__main__":
    main()

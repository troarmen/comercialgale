#!/usr/bin/env python3
"""
Recupera o negrito das descrições de produto a partir do painel antigo.

O que aconteceu: o painel de 2013 guardava a descrição como pedaço de HTML,
e o Arthur usava negrito (<b>/<strong>) para destacar composição, cuidados e
detalhes. A extração (extrair_legado.py, `campos` -> `texto_limpo`) arrancou
TODAS as tags, e o backup local (db/migracao/legado/produtos.jsonl e
db/migracao/backup-descricoes/) já nasceu sem nenhuma. Ou seja: daqui de
dentro não há o que recuperar — é preciso ler o HTML bruto de novo na fonte.

Como funciona:
  1. Lê, no painel antigo, o HTML BRUTO do <textarea name="descricao"> de cada
     produto (o mesmo formulário e o mesmo login do extrair_legado.py).
  2. Refaz a limpeza que a migração fez (texto_limpo + limpar_descricoes.limpar)
     e marca, nesse texto limpo, os trechos que estavam em <b>/<strong> como
     **trecho** — o formato que o painel novo e a loja entendem
     (src/lib/descricao.tsx).
  3. Só grava quando a descrição atual do banco é IGUAL ao texto recuperado
     sem os **. Se o Arthur mexeu na descrição depois da migração (no painel
     novo ou no antigo), o produto fica de fora e aparece no relatório: o
     negrito não vale apagar uma edição dele.

Endereço do painel antigo: o domínio comercialgale.com.br aponta para a
Vercel desde 11–12/11/2026, então o legado só responde por outro endereço
(o temporário da KingHost, um IP, um subdomínio). Informe em LEGADO_BASE.
Sem LEGADO_BASE o script se recusa a ler a rede.

Alternativa sem o painel: LEGADO_HTML=pasta/ com um arquivo <legado_id>.html
por produto (a página do formulário antigo salva, ou só o HTML da descrição).

Uso:
    python3 scripts/recuperar_negrito.py --testar     # testes da conversão, sem rede nem banco
    LEGADO_BASE=https://endereco-antigo python3 scripts/recuperar_negrito.py            # ensaio
    LEGADO_BASE=https://endereco-antigo python3 scripts/recuperar_negrito.py --aplicar  # grava
    GALE_ENV=.env.producao.local LEGADO_BASE=... python3 scripts/recuperar_negrito.py   # banco de produção

    LEGADO_LOGIN / LEGADO_SENHA trocam o login (padrão: o do extrair_legado.py).
    LEGADO_IDS=228,1860 limita a alguns produtos (bom para o primeiro teste).

Ensaio é o padrão: lê tudo e mostra o que mudaria, sem gravar. --aplicar
grava um backup das descrições que vão mudar antes de tocar no banco, e cada
UPDATE só acontece se a descrição ainda for a que foi lida (outra pessoa
editando no meio do caminho não é atropelada).
"""

import html
import json
import os
import re
import sys
import time
from datetime import datetime
from urllib.parse import quote

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP = os.path.join(RAIZ, "db", "migracao", "backup-descricoes")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# A mesma limpeza da migração, importada — não copiada. Se alguém mudar a
# regra lá, a comparação aqui continua batendo com o que está no banco.
from limpar_descricoes import limpar  # noqa: E402

MARCA = "**"


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ------------------------------------------------------------- conversão pura

def texto_limpo(bruto):
    """Cópia fiel de extrair_legado.texto_limpo (lá ela vive num módulo que
    exige `requests`, e o --testar precisa rodar sem dependência nenhuma).
    O teste `test_texto_limpo_igual_ao_extrator` confere que são a mesma."""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", bruto)).strip()


def como_na_migracao(bruto):
    """Exatamente o caminho que a descrição fez até o banco:
    extrair_legado (texto_limpo, `or None`) -> importar_catalogo (limpar)."""
    return limpar(texto_limpo(bruto) or None) if bruto else None


_TAG = re.compile(r"<[^>]+>")  # a MESMA definição de tag do texto_limpo
_NOME = re.compile(r"<\s*(/)?\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>")
_ESTILO_NEGRITO = re.compile(r"font-weight\s*:\s*(bold|bolder|[6-9]00)", re.I)
_VAZIAS = {"br", "img", "hr", "input", "meta", "link", "wbr", "col", "area", "source"}


def negritos(bruto):
    """
    Trechos em negrito MAIS EXTERNOS, na ordem: [(posição no bruto, HTML de dentro)].

    Negrito é <b>, <strong> ou um elemento com font-weight bold/600+ no style
    (o que o Word cola). Negrito dentro de negrito conta uma vez só. As tags são
    lidas com a mesma regex que a migração usou para apagá-las, então o que é
    "tag" aqui é exatamente o que virou espaço lá.
    """
    pilha, saida, inicio = [], [], None  # pilha: [(tag, abre_negrito)]
    for m in _TAG.finditer(bruto or ""):
        t = _NOME.match(m.group(0))
        if not t:
            continue  # comentário, <!DOCTYPE>…
        fecha, tag, resto = t.group(1), t.group(2).lower(), t.group(3)
        if fecha:
            # fecha até a tag correspondente (HTML antigo nem sempre fecha em ordem)
            for i in range(len(pilha) - 1, -1, -1):
                if pilha[i][0] == tag:
                    fechadas = pilha[i:]
                    del pilha[i:]
                    if inicio is not None and any(n for _, n in fechadas) and not any(n for _, n in pilha):
                        saida.append((inicio, bruto[inicio:m.start()]))
                        inicio = None
                    break
            continue
        if tag in _VAZIAS or resto.rstrip().endswith("/"):
            continue
        neg = tag in ("b", "strong") or bool(_ESTILO_NEGRITO.search(resto))
        if neg and not any(n for _, n in pilha):
            inicio = m.end()
        pilha.append((tag, neg))
    if inicio is not None:  # negrito que nunca fechou vai até o fim
        saida.append((inicio, bruto[inicio:]))
    return saida


def _plano(trecho_html):
    """HTML -> texto, com as mesmas trocas da migração (tag vira espaço,
    entidade desfeita uma vez, espaço duro vira espaço comum)."""
    t = html.unescape(_TAG.sub(" ", trecho_html)).replace("\xa0", " ")
    return re.sub(r"\s+", " ", _TAG.sub(" ", t)).strip()


def trechos_em_negrito(bruto):
    """Textos em negrito do HTML, já normalizados como a migração normaliza."""
    return [t for t in (_plano(h) for _, h in negritos(bruto)) if t]


def _esqueleto(texto):
    """Quantos caracteres "de verdade" há no texto. A limpeza só mexe em
    espaço, quebra e no ":" depois de "Características", então essa conta é a
    mesma antes e depois dela — e serve de régua para achar, no texto limpo,
    a ocorrência certa de um trecho que aparece mais de uma vez."""
    return len(re.sub(r"[\s:]", "", texto))


def _padrao(trecho):
    # Entre as palavras, a migração pode ter posto espaço, quebra de parágrafo
    # ou o ": " depois de "Características". As pontas não podem cortar palavra.
    palavras = [re.escape(p) for p in trecho.split()]
    return re.compile(r"(?<!\w)" + r"(?:\s|:)+".join(palavras) + r"(?!\w)")


def _embrulha(pedaco):
    """**pedaço**, linha por linha — o negrito não atravessa quebra de linha."""
    saida = []
    for linha in pedaco.split("\n"):
        m = re.match(r"^(\s*)(.*?)(\s*)$", linha)
        saida.append(f"{m.group(1)}{MARCA}{m.group(2)}{MARCA}{m.group(3)}" if m.group(2) else linha)
    return "\n".join(saida)


def recuperar(bruto):
    """
    HTML bruto -> (texto_com_negrito, texto_como_migrado, trechos_nao_achados).

    Garantia: texto_com_negrito sem os ** é IDÊNTICO a texto_como_migrado.
    Os ** só são inseridos; nada do texto muda.
    """
    limpo = como_na_migracao(bruto)
    if not limpo:
        return None, None, []

    # régua: esqueleto acumulado até cada posição do texto limpo
    regua, n = [0], 0
    for ch in limpo:
        n += 0 if (ch.isspace() or ch == ":") else 1
        regua.append(n)

    partes, cursor, faltando = [], 0, []
    for pos, interno in negritos(bruto):
        trecho = _plano(interno)
        if not trecho:
            continue
        alvo = _esqueleto(_plano(bruto[:pos]))  # quanto texto vinha antes do negrito
        candidatos = [m for m in _padrao(trecho).finditer(limpo) if m.start() >= cursor]
        if not candidatos:
            faltando.append(trecho)
            continue
        m = min(candidatos, key=lambda c: abs(regua[c.start()] - alvo))
        partes.append(limpo[cursor:m.start()])
        partes.append(_embrulha(m.group(0)))
        cursor = m.end()
    partes.append(limpo[cursor:])
    com = "".join(partes)
    # **a** **b** colados viram um trecho só: "**a b**"
    com = re.sub(r"\*\*([ \t]+)\*\*", r"\1", com)
    assert sem_marcas(com) == limpo, "a recuperação alterou o texto"
    return com, limpo, faltando


def sem_marcas(texto):
    return (texto or "").replace(MARCA, "")


def normaliza(texto):
    """Como o painel grava: \\n puro, sem espaço nas pontas."""
    return (texto or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def decidir(atual, recuperado):
    """O que fazer com um produto. Devolve (situacao, texto_novo_ou_None)."""
    if recuperado is None:
        return "sem_descricao_no_legado", None
    if MARCA not in recuperado:
        return "sem_negrito_no_legado", None
    if MARCA in (atual or ""):
        return "ja_tem_negrito", None  # recuperado antes, ou editado no painel novo
    if normaliza(atual) != sem_marcas(recuperado):
        return "texto_mudou", None      # editado depois da migração: não mexe
    return "atualizar", recuperado


def descricao_do_formulario(pagina):
    """O HTML bruto de dentro do <textarea name="descricao">, ou a página
    inteira se ela não tiver textarea (arquivo com só a descrição)."""
    m = re.search(
        r"<textarea[^>]*name=['\"]descricao['\"][^>]*>(.*?)</textarea>", pagina, re.S | re.I
    )
    return m.group(1) if m else (None if "<textarea" in pagina.lower() else pagina)


# ------------------------------------------------------------------- testes

def testar():
    falhas = 0

    def igual(obtido, esperado, nome):
        nonlocal falhas
        if obtido == esperado:
            print(f"  ok  {nome}")
        else:
            falhas += 1
            print(f"  FALHOU {nome}\n     obtido:   {obtido!r}\n     esperado: {esperado!r}")

    print("conversão HTML -> **negrito**")
    r = recuperar("<p>Cueca slip em <strong>microfibra</strong> com elástico</p>"
                  "<p>&nbsp;</p><p><strong>Características</strong> 94% Poliamida e 06% Elastano</p>")
    igual(r[1], "Cueca slip em microfibra com elástico\n\nCaracterísticas: 94% Poliamida e 06% Elastano",
          "limpeza igual à da migração (parágrafo e dois-pontos)")
    igual(r[0], "Cueca slip em **microfibra** com elástico\n\n**Características**: 94% Poliamida e 06% Elastano",
          "negrito marcado")
    igual(sem_marcas(r[0]), r[1], "sem os ** volta ao texto migrado")

    igual(recuperar("<b>Lavar   à mão</b>, não usar alvejante")[0],
          "**Lavar à mão** , não usar alvejante", "<b> e espaços repetidos (a vírgula descolada é da migração)")
    igual(recuperar("Tecido <strong><b>duplo</b></strong> reforçado")[0],
          "Tecido **duplo** reforçado", "negrito aninhado conta uma vez")
    igual(recuperar('Cor <span style="font-weight: bold;">preta</span> e <span style="font-weight:700">branca</span>')[0],
          "Cor **preta** e **branca**", "span com font-weight do Word")
    igual(recuperar("<strong>Malha&nbsp;fria</strong> &ndash; leve")[0],
          "**Malha fria** – leve", "entidades dentro e fora do negrito")
    igual(recuperar("Algodão <strong> </strong>penteado")[0], "Algodão penteado", "negrito vazio some")
    igual(recuperar("<strong>um</strong><strong>dois</strong> três")[0], "**um dois** três", "negritos colados viram um")
    igual(recuperar("Texto apresentando&nbsp;&nbsp; <strong>o modelo&nbsp;&nbsp; Características 100% algodão</strong>")[0],
          "Texto apresentando **o modelo**\n\n**Características: 100% algodão**",
          "negrito que atravessa o parágrafo criado pela limpeza")
    igual(recuperar("Sutiã <strong>a</strong> bojo com alça")[0], "Sutiã **a** bojo com alça",
          "letra solta não casa dentro de palavra")
    igual(recuperar("sem negrito nenhum")[0], "sem negrito nenhum", "sem negrito: texto igual")
    igual(recuperar("")[0], None, "descrição vazia")
    igual(recuperar("<strong>aberto sem fechar")[0], "**aberto sem fechar**", "negrito que nunca fechou")
    igual(trechos_em_negrito("<p><B>Maiúscula</B></p>"), ["Maiúscula"], "tag em maiúscula")
    igual(recuperar("Marca <b>P&amp;B&nbsp;&reg;</b> fim")[0], "Marca **P&B ®** fim", "entidade desfeita uma vez só, como na migração")
    igual(recuperar("<p>Linha um<br><strong>Linha</strong> dois</p>")[0], "Linha um **Linha** dois", "<br> vira espaço, como na migração")
    igual(recuperar("Algodão macio. <b>Algodão</b> penteado e <b>Algodão</b>")[0],
          "Algodão macio. **Algodão** penteado e **Algodão**", "trecho repetido: marca a ocorrência certa")

    print("decisão por produto")
    rec = "Cueca **microfibra**\n\nCaracterísticas: 94%"
    igual(decidir("Cueca microfibra\n\nCaracterísticas: 94%", rec), ("atualizar", rec), "texto intacto: atualiza")
    igual(decidir("Cueca microfibra\r\n\r\nCaracterísticas: 94%", rec), ("atualizar", rec), "\\r\\n do formulário não conta como edição")
    igual(decidir("Cueca microfibra editada", rec), ("texto_mudou", None), "editado depois: não mexe")
    igual(decidir("Cueca **microfibra** nova", rec), ("ja_tem_negrito", None), "já tem negrito: não mexe")
    igual(decidir(rec, rec), ("ja_tem_negrito", None), "já recuperado: não mexe")
    igual(decidir("Cueca", "Cueca"), ("sem_negrito_no_legado", None), "legado sem negrito: nada a fazer")
    igual(decidir("x", None), ("sem_descricao_no_legado", None), "legado sem descrição")

    print("leitura do formulário antigo")
    pagina = '<form><input name="titulo" value="x"><textarea name="descricao" rows="5"><p>a <strong>b</strong></p>\n</textarea></form>'
    igual(descricao_do_formulario(pagina), "<p>a <strong>b</strong></p>\n", "HTML bruto do textarea")
    igual(descricao_do_formulario("<p>só a descrição</p>"), "<p>só a descrição</p>", "arquivo com só a descrição")
    igual(descricao_do_formulario('<textarea name="obs">x</textarea>'), None, "formulário sem o campo")

    print("mesma limpeza da migração")
    try:
        import extrair_legado  # exige `requests`
        amostra = "<p>a&nbsp; <b>b</b>\n\n c</p>"
        igual(texto_limpo(amostra), extrair_legado.texto_limpo(amostra), "texto_limpo igual ao do extrator")
    except ImportError:
        print("  (pulado: `requests` não instalado — texto_limpo do extrator não pôde ser importado)")

    print(f"\n{'TUDO CERTO' if not falhas else f'{falhas} FALHA(S)'}")
    return falhas


# --------------------------------------------------------------- banco e rede

def carrega_env():
    # GALE_ENV=.env.producao.local aponta para o Supabase de produção; sem ela,
    # usa o .env.local (normalmente o Supabase local, 127.0.0.1)
    env = {}
    with open(os.path.join(RAIZ, os.environ.get("GALE_ENV", ".env.local")), encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                k, v = linha.split("=", 1)
                env[k.strip()] = v.strip()
    if not env.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise SystemExit("SUPABASE_SERVICE_ROLE_KEY ausente no arquivo de ambiente")
    return env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"), env["SUPABASE_SERVICE_ROLE_KEY"]


class Banco:
    def __init__(self):
        import requests

        self.url, chave = carrega_env()
        self.s = requests.Session()
        self.s.headers.update({
            "apikey": chave,
            "Authorization": f"Bearer {chave}",
            "Content-Type": "application/json",
        })

    def produtos_do_legado(self):
        r = self.s.get(
            f"{self.url}/rest/v1/produtos?select=id,modelo,legado_id,descricao"
            "&legado_id=not.is.null&order=id&limit=5000",
            timeout=60,
        )
        r.raise_for_status()
        return r.json()

    def atualizar(self, pid, antes, depois):
        """UPDATE condicional: só se a descrição ainda for `antes`."""
        filtro = "descricao=is.null" if antes is None else f"descricao=eq.{quote(antes, safe='')}"
        r = self.s.patch(
            f"{self.url}/rest/v1/produtos?id=eq.{pid}&{filtro}",
            headers={"Prefer": "return=representation"},
            data=json.dumps({"descricao": depois}),
            timeout=60,
        )
        r.raise_for_status()
        return len(r.json()) == 1


def fonte_de_html():
    """Função legado_id -> HTML bruto da descrição (ou None)."""
    pasta = os.environ.get("LEGADO_HTML")
    if pasta:
        log(f"Fonte: arquivos em {pasta}")

        def de_arquivo(lid):
            caminho = os.path.join(pasta, f"{lid}.html")
            if not os.path.exists(caminho):
                return None
            with open(caminho, encoding="utf-8", errors="replace") as f:
                return descricao_do_formulario(f.read())
        return de_arquivo

    base = os.environ.get("LEGADO_BASE", "").rstrip("/")
    if not base:
        raise SystemExit(
            "Informe LEGADO_BASE (endereço do painel antigo, ex.: https://ip-ou-dominio-temporario)\n"
            "ou LEGADO_HTML (pasta com <legado_id>.html). comercialgale.com.br hoje é o site novo."
        )
    import extrair_legado as legado  # login, retentativa e relogin já resolvidos lá

    legado.BASE = base  # a classe Painel lê o endereço deste módulo
    if os.environ.get("LEGADO_LOGIN"):
        legado.LOGIN = os.environ["LEGADO_LOGIN"]
    if os.environ.get("LEGADO_SENHA"):
        legado.SENHA = os.environ["LEGADO_SENHA"]
    log(f"Fonte: painel antigo em {base}")
    painel = legado.Painel()

    def do_painel(lid):
        pagina = painel.post("/controller/produto/cadastro", {"id": lid, "m": "produto"})
        time.sleep(legado.PAUSA)  # o servidor antigo é lento; sem pressa
        return descricao_do_formulario(pagina)
    return do_painel


def main():
    if "--testar" in sys.argv:
        sys.exit(1 if testar() else 0)

    aplicar = "--aplicar" in sys.argv
    banco = Banco()
    log(f"Banco de destino: {banco.url}")
    produtos = banco.produtos_do_legado()
    so = {int(x) for x in os.environ.get("LEGADO_IDS", "").split(",") if x.strip()}
    if so:
        produtos = [p for p in produtos if p["legado_id"] in so]
    log(f"Produtos vindos do legado: {len(produtos)}")

    ler = fonte_de_html()
    grupos, mudancas, nao_achados = {}, [], []
    for n, p in enumerate(produtos, 1):
        try:
            bruto = ler(p["legado_id"])
        except Exception as e:  # um produto que falha não derruba os outros
            log(f"  falha ao ler legado {p['legado_id']}: {e}")
            bruto = None
        com, _, faltando = recuperar(bruto) if bruto else (None, None, [])
        if faltando:
            nao_achados.append((p["modelo"], faltando))
        situacao, novo = decidir(p.get("descricao"), com)
        grupos.setdefault(situacao, []).append(p["modelo"])
        if novo:
            mudancas.append((p, novo))
        if n % 50 == 0:
            log(f"  {n}/{len(produtos)}")

    print("\n--- resultado ---")
    nomes = {
        "atualizar": "ganham o negrito",
        "texto_mudou": "NÃO mexidos: descrição editada depois da migração (rever à mão)",
        "ja_tem_negrito": "NÃO mexidos: já têm negrito",
        "sem_negrito_no_legado": "sem negrito no original",
        "sem_descricao_no_legado": "sem descrição/sem resposta no legado",
    }
    for chave, rotulo in nomes.items():
        refs = grupos.get(chave, [])
        print(f"{len(refs):5}  {rotulo}" + (f"  ex.: {', '.join(refs[:8])}" if refs and chave != "sem_negrito_no_legado" else ""))
    if nao_achados:
        print(f"\n{len(nao_achados)} produto(s) com trecho em negrito não localizado no texto atual (fica sem esse negrito):")
        for ref, trechos in nao_achados[:10]:
            print(f"  ref {ref}: {trechos[:3]}")

    if not aplicar:
        print("\n--- ENSAIO (nada foi gravado) ---")
        for p, novo in mudancas[:5]:
            print(f"\n[ref {p['modelo']}]\n  antes:  {p['descricao'][:200]!r}\n  depois: {novo[:200]!r}")
        print("\nrode com --aplicar para gravar")
        return

    if not mudancas:
        print("nada a gravar")
        return
    os.makedirs(BACKUP, exist_ok=True)
    caminho = os.path.join(BACKUP, f"negrito-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json")
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump([{"id": p["id"], "modelo": p["modelo"], "descricao": p["descricao"]} for p, _ in mudancas],
                  f, ensure_ascii=False, indent=1)
    log(f"backup: {caminho}")

    gravados, pulados = 0, []
    for p, novo in mudancas:
        if banco.atualizar(p["id"], p["descricao"], novo):
            gravados += 1
        else:
            pulados.append(p["modelo"])  # mudou entre a leitura e a gravação
    log(f"pronto: {gravados} descrições com negrito" + (f"; {len(pulados)} mudaram no meio e ficaram: {pulados[:10]}" if pulados else ""))


if __name__ == "__main__":
    main()

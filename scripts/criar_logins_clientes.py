#!/usr/bin/env python3
"""
Cria, em lote e SEM MANDAR E-MAIL, o login dos clientes importados do sistema
antigo — o mesmo que o botão "criar acesso" da ficha faz, menos o convite.

Depois disso o cliente entra sozinho: Entrar → "Esqueci minha senha" → digita
o e-mail cadastrado → recebe o link e cria a senha. Os e-mails saem aos
poucos, conforme as pessoas pedem (sem disparo em massa no Brevo).

Regras:
  • só clientes com status 'ativo' e sem login;
  • e-mail precisa ser válido e único entre os clientes;
  • e-mail que já tem login no Auth (equipe, testes) NÃO é vinculado
    automaticamente — vai para a lista de revisão.

Uso (sempre apontando para produção de propósito):
    GALE_ENV=.env.producao.local python scripts/criar_logins_clientes.py            # ensaio
    GALE_ENV=.env.producao.local python scripts/criar_logins_clientes.py --gravar   # cria
    GALE_ENV=.env.producao.local python scripts/criar_logins_clientes.py --desfazer ARQUIVO.jsonl

Cada execução com --gravar grava em db/migracao/legado/ um .jsonl com os
logins criados — é o que o --desfazer usa para apagar exatamente esses.
"""
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict

import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "db", "migracao", "legado")
EMAIL = re.compile(r"^[^@\s;,]+@[^@\s;,]+\.[a-z]{2,}$", re.I)


def env():
    d = {}
    arquivo = os.environ.get("GALE_ENV", ".env.local")
    for linha in open(os.path.join(RAIZ, arquivo), encoding="utf-8"):
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            d[k.strip()] = v.strip()
    return d


E = env()
URL = E["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = E["SUPABASE_SERVICE_ROLE_KEY"]
print(f"Banco de destino: {URL}", flush=True)
S = requests.Session()
S.headers.update({"apikey": KEY, "Authorization": f"Bearer {KEY}"})


def todos_clientes():
    out, passo, ini = [], 500, 0
    while True:
        r = S.get(
            f"{URL}/rest/v1/clientes",
            params={"select": "id,nome,nome_fantasia,email,status,user_id,pode_ver_precos", "order": "id"},
            headers={"Range": f"{ini}-{ini + passo - 1}"},
        )
        r.raise_for_status()
        lote = r.json()
        out += lote
        if len(lote) < passo:
            return out
        ini += passo


def todos_usuarios_auth():
    out, pagina = [], 1
    while True:
        r = S.get(f"{URL}/auth/v1/admin/users", params={"page": pagina, "per_page": 500})
        r.raise_for_status()
        lote = r.json().get("users", [])
        out += lote
        if len(lote) < 500:
            return out
        pagina += 1


def classificar():
    clientes = todos_clientes()
    emails_auth = {(u.get("email") or "").lower() for u in todos_usuarios_auth()}

    por_email = defaultdict(list)
    for c in clientes:
        e = (c.get("email") or "").strip().lower()
        if e:
            por_email[e].append(c["id"])

    grupos = defaultdict(list)
    for c in clientes:
        e = (c.get("email") or "").strip().lower()
        if c["user_id"]:
            grupos["ja_tem_login"].append(c)
        elif c["status"] != "ativo":
            grupos[f"status_{c['status']}"].append(c)
        elif not e:
            grupos["sem_email"].append(c)
        elif not EMAIL.match(e):
            grupos["email_invalido"].append(c)
        elif len(por_email[e]) > 1:
            grupos["email_repetido"].append(c)
        elif e in emails_auth:
            grupos["email_ja_no_auth"].append(c)
        else:
            c["email_limpo"] = e
            grupos["vai_criar"].append(c)
    return clientes, grupos


def relatorio(clientes, grupos):
    print(f"\nClientes no banco: {len(clientes)}")
    rotulos = [
        ("vai_criar", "VÃO GANHAR LOGIN"),
        ("ja_tem_login", "já têm login"),
        ("status_inativo", "inativos (fora)"),
        ("status_incompleto", "cadastro incompleto (fora)"),
        ("sem_email", "sem e-mail (fora)"),
        ("email_invalido", "e-mail inválido (fora)"),
        ("email_repetido", "e-mail repetido em outra ficha (fora)"),
        ("email_ja_no_auth", "e-mail já é login de outra pessoa (fora)"),
    ]
    for chave, rotulo in rotulos:
        print(f"  {len(grupos.get(chave, [])):5d}  {rotulo}")
    sem_preco = sum(1 for c in grupos.get("vai_criar", []) if not c["pode_ver_precos"])
    if sem_preco:
        print(f"         ({sem_preco} dos que ganham login estão com 'ver preços' desligado)")

    for chave in ("email_invalido", "email_repetido", "email_ja_no_auth"):
        lista = grupos.get(chave, [])
        if lista:
            print(f"\n--- {chave} ({len(lista)}) ---")
            for c in sorted(lista, key=lambda c: (c.get("email") or "").lower()):
                print(f"  #{c['id']:<6} {c.get('email')!r:45} {c['nome'][:40]}")


def gravar(grupos):
    alvo = grupos.get("vai_criar", [])
    arq = os.path.join(SAIDA, f"logins-criados-{time.strftime('%Y%m%d-%H%M')}.jsonl")
    ok = falha = 0
    with open(arq, "a", encoding="utf-8") as f:
        for i, c in enumerate(alvo, 1):
            r = S.post(
                f"{URL}/auth/v1/admin/users",
                json={
                    "email": c["email_limpo"],
                    "email_confirm": True,
                    "user_metadata": {"nome": c["nome"]},
                    "app_metadata": {"role": "cliente"},
                },
            )
            if r.status_code >= 300:
                falha += 1
                print(f"  FALHA criar #{c['id']} {c['email_limpo']}: {r.status_code} {r.text[:150]}")
                continue
            uid = r.json()["id"]
            v = S.patch(
                f"{URL}/rest/v1/clientes",
                params={"id": f"eq.{c['id']}", "user_id": "is.null"},
                json={"user_id": uid, "email": c["email_limpo"]},
                headers={"Prefer": "return=representation"},
            )
            if v.status_code >= 300 or not v.json():
                # não deixa login órfão
                S.delete(f"{URL}/auth/v1/admin/users/{uid}")
                falha += 1
                print(f"  FALHA vincular #{c['id']}: {v.status_code} {v.text[:150]}")
                continue
            f.write(json.dumps({"cliente_id": c["id"], "user_id": uid, "email": c["email_limpo"]}) + "\n")
            f.flush()
            ok += 1
            if i % 100 == 0:
                print(f"  {i}/{len(alvo)}…", flush=True)
            time.sleep(0.05)
    print(f"\nCriados e vinculados: {ok}   Falhas: {falha}")
    print(f"Registro (para desfazer): {arq}")


def desfazer(arq):
    n = 0
    for linha in open(arq, encoding="utf-8"):
        d = json.loads(linha)
        # on delete set null limpa clientes.user_id sozinho
        r = S.delete(f"{URL}/auth/v1/admin/users/{d['user_id']}")
        if r.status_code < 300:
            n += 1
        else:
            print(f"  falha ao apagar {d['email']}: {r.status_code}")
    print(f"Logins apagados: {n}")


if __name__ == "__main__":
    if "--desfazer" in sys.argv:
        desfazer(sys.argv[sys.argv.index("--desfazer") + 1])
        sys.exit()
    clientes, grupos = classificar()
    relatorio(clientes, grupos)
    if "--gravar" in sys.argv:
        print("\nGravando…")
        gravar(grupos)
    else:
        print("\nEnsaio: nada foi gravado. Rode com --gravar para criar.")

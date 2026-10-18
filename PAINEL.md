# Painel do administrador — o que já existe

Documento para quem for construir o **catálogo do cliente** (`comercialgale.com.br`).
O painel (`/admin`) está pronto e em uso; este texto explica o que ele assume,
o que já resolve, e onde o catálogo vai encostar nele.

Leia inteiro antes de escrever a primeira linha do catálogo. Três coisas aqui
não são óbvias e custaram tempo para descobrir: a **trava de preço por coluna**
(§3), o fato de **pedido ser assunto exclusivo do painel** (§4), e o
**vocabulário de kit** (§2).

---

## 1. O negócio em quatro frases

A Galé é atacadista de moda íntima. O lojista navega o catálogo **sem ver
preço**. Quando o Arthur (dono) aprova o cadastro, ele cria um login e aí os
preços aparecem. O lojista monta o carrinho e fecha o pedido — **o pagamento
não passa pelo site, e é para continuar assim**: sai um e-mail, e o Arthur
liga para combinar.

Consequência direta para o catálogo: não existe checkout, gateway, frete
calculado nem "meus pedidos". Fechar o pedido é gravar duas tabelas e mandar
e-mail.

---

## 2. Modelo de dados

Fonte de verdade: [`db/schema.sql`](db/schema.sql). Vale ler — os comentários
explicam o porquê de cada decisão. Tipos TypeScript gerados em
[`src/lib/supabase/tipos.ts`](src/lib/supabase/tipos.ts) (não edite à mão;
regenere, veja §9).

### Vocabulário: kit

Produto é vendido em **kit fechado**, e o Arthur cadastra o **preço do kit**,
não o da peça. O site divide.

| Coluna | Significado |
|---|---|
| `kits.pecas` | quantas peças vêm no kit (1, 3, 6…) |
| `produtos.preco_atacado` | preço **do kit** para o lojista |
| `produtos.preco_varejo` | preço **do kit** sugerido para revenda |
| `pedido_itens.qtd_kits` | quantos kits o cliente pediu |
| `pedido_itens.pecas_no_kit` | cópia congelada de `kits.pecas` |

Não invente "preço unitário" como campo — ele é sempre derivado
(`preco_kit / pecas`). Isso foi verificado contra 698 pedidos reais do sistema
antigo; os totais batem.

### Tabelas

`profiles` · `clientes` · `fabricantes` · `categorias` · `subcategorias` ·
`tamanhos` · `kits` · `produtos` · `produto_tamanhos` · `produto_imagens` ·
`pedidos` · `pedido_itens` · `configuracoes` · `log_atividades`

Notas que economizam tempo:

- **`produto_tamanhos`** é a grade. `preco_atacado`/`preco_varejo` ali são
  **NULL na maioria** — significa "herda do produto". Só ~30 produtos cobram
  mais em tamanhos grandes (54/56, 58/60). Use a view (§3), que já resolve.
- **`tamanhos`** mistura cinco naturezas na mesma tabela, herdado do legado:
  `tamanho` (P, M, G), `numeracao` (34/35), `faixa_etaria` (2 a 4 anos),
  `grade` (4P/4M/4G) e `cor` (TU - Branco). A coluna `tipo` separa. No painel
  isso vira `<optgroup>`; no catálogo, decida como apresentar.
- **`produtos.busca`** é um `tsvector` mantido por trigger (título e modelo com
  peso A, tags B, descrição C). Use para a busca do catálogo em vez de `ilike`.
- **`produtos.descricao`** contém quebras de parágrafo (`\n\n`) de verdade.
  **Renderize com `white-space: pre-line`** ou equivalente, senão vira bloco
  corrido. (As entidades HTML do legado — 1.239 `&nbsp;` — já foram limpas;
  veja `scripts/limpar_descricoes.py`.)
- **`pedido_itens`** guarda **cópia congelada** de título, modelo, tamanho e
  preços. Produto renomeado ou excluído depois não corrompe o histórico.
  `produto_id` e `produto_tamanho_id` são `on delete set null`.
- **`configuracoes`** é chave/valor JSON. Três chaves são legíveis
  publicamente: `pedido_minimo_valor` (hoje R$ 500), `catalogo_aviso`,
  `exibir_preco_varejo`. **`emails_notificacao` não é** — só o painel lê.

---

## 3. A trava de preço — leia com atenção

**RLS do Postgres filtra LINHAS, não COLUNAS.** O catálogo é público de
propósito, então um visitante sem login recebe a linha do produto. Sem
proteção extra, bastaria pedir `?select=preco_atacado` na API do PostgREST
para levar a tabela de preços inteira. *Isso foi testado e vazava mesmo.*

A proteção é **privilégio de coluna**, em `db/schema.sql` §8:

```sql
revoke select on public.produtos         from anon, authenticated;
revoke select on public.produto_tamanhos from anon, authenticated;

grant select (id, categoria_id, ..., busca, created_at, updated_at)
  on public.produtos to anon, authenticated;
```

> **Ordem importa.** Quem tem SELECT no nível da TABELA lê todas as colunas, e
> um `REVOKE SELECT (coluna)` sozinho **não surte efeito nenhum**. É preciso
> revogar a tabela inteira e reconceder coluna a coluna. (Também testado: com
> só o revoke de coluna, o preço continuava saindo.)

### A única porta para preço: `precos_visiveis`

```sql
select produto_id, produto_tamanho_id, tamanho, pecas_no_kit,
       preco_kit_atacado,      -- herança já resolvida — use este
       preco_kit_varejo,
       preco_base_atacado,     -- preço do produto, ignorando o tamanho
       preco_base_varejo,
       preco_proprio_atacado,  -- NULL quando o tamanho herda
       preco_proprio_varejo,
       preco_unitario_atacado, -- kit / pecas, já arredondado
       preco_unitario_varejo
  from public.precos_visiveis where produto_id = $1;
```

A view checa `pode_ver_precos()` internamente: devolve **zero linhas** para
visitante sem login ou cliente suspenso. Não há como escapar disso pelo
cliente. Para o catálogo, `preco_kit_*` e `preco_unitario_*` bastam — as
colunas `base`/`proprio` existem para o formulário do painel distinguir preço
herdado de preço próprio.

### Duas armadilhas que decorrem da trava

**1. `count(*)` em `produtos` e `produto_tamanhos` dá 403.** Contagem exige
SELECT no nível da tabela. Isso inclui agregado embutido do PostgREST:

```ts
// ✗ 403
.select("*, produtos(count)")
// ✓ conte uma coluna concedida
.select("id", { count: "exact", head: true })
```

**2. `upsert` nessas duas tabelas dá 403.** `INSERT ... ON CONFLICT DO UPDATE`
também exige SELECT da tabela. O painel resolve lendo as linhas existentes
(colunas concedidas), fazendo `update` por `id` e `insert` só do que é novo —
veja `salvarProduto` em
[`src/app/admin/(painel)/produtos/[id]/acoes.ts`](src/app/admin/%28painel%29/produtos/%5Bid%5D/acoes.ts).

### Quem pode ver preço

```sql
pode_ver_precos() = is_admin()
  OR existe cliente com user_id = auth.uid()
             AND status = 'ativo'
             AND pode_ver_precos
```

São **dois interruptores** por cliente, de propósito: `status = 'ativo'`
controla o login em si; `pode_ver_precos` suspende os preços sem derrubar o
acesso (cliente inadimplente, por exemplo). Os dois ficam na ficha do cliente
no painel.

---

## 4. Pedido é assunto exclusivo do painel

Decisão do cliente, textual: **"Pedidos NUNCA, NUNCA devem ficar visíveis para
cliente algum. Isso fica tudo no painel de admin."**

Por isso `pedidos` e `pedido_itens` têm **apenas política de INSERT** para o
cliente. Sem política de SELECT, o RLS nega leitura por padrão — nem os
próprios pedidos ele lê, mesmo chamando a API direto com token válido.

**Não crie uma tela "meus pedidos".** Não adicione política de SELECT. A
confirmação que o cliente recebe é o e-mail; daí em diante o assunto corre
pelo contato do Arthur.

Ao fechar o pedido, grave em `pedidos` e `pedido_itens`; um trigger
(`recalcular_pedido`) recalcula `total_atacado`, `total_varejo` e `total_pecas`
a partir dos itens. **Não confie em total calculado no navegador** — o trigger
é a autoridade, e existe justamente para um arredondamento no front não virar
divergência no valor cobrado.

Status inicial: `novo`. O fluxo completo é
`novo → em_contato → aguardando_pagamento → pago → em_separacao → enviado →
concluido` (+ `cancelado`), e quem move é o Arthur pelo painel.

---

## 5. E-mail

Existe e mora no catálogo: `src/lib/email.ts` (nodemailer, SMTP por variável
de ambiente — em produção, o **Brevo**). Detalhes em CATALOGO.md §4; como pôr
no ar (domínio no Brevo, DNS, variáveis) em [DEPLOY.md](DEPLOY.md).

Para quem mexe no painel, o que importa:

- **Nenhum e-mail de senha passa pelo Supabase.** Criar login (cliente ou
  colaborador) e "Enviar link para criar nova senha" usam
  `auth.admin.generateLink` + **link próprio** enviado pelo nosso SMTP
  (`src/lib/links-senha.ts`). Não use `resetPasswordForEmail`: com o
  `@supabase/ssr` ele usa PKCE, e o link só funciona no navegador de quem
  pediu — o do Arthur.
- **Ninguém recebe senha provisória.** O login nasce sem senha; a pessoa cria
  a dela pelo link (vale 1 h, uso único). Se o e-mail falhar, o painel mostra
  o link para o Arthur copiar e mandar por WhatsApp.
- `emails_notificacao` recebe o aviso de **pedido novo** e de **cadastro novo
  para aprovar**.

---

## 6. Stack e convenções

Next **16.3.0** (App Router) · React 19.2.8 · TypeScript · Tailwind **v4** ·
Supabase (Postgres + Auth + Storage).

- **Esta versão do Next tem mudanças que quebram o que você "sabe".** O
  `AGENTS.md` na raiz (escrito pelo próprio `next dev`) manda ler os guias em
  `node_modules/next/dist/docs/` antes de escrever código. Siga — foi assim que
  descobrimos o item abaixo.
- **`middleware.ts` virou `proxy.ts`** no Next 16, e a função exportada chama
  `proxy`, não `middleware`. Veja [`src/proxy.ts`](src/proxy.ts).
- **Código em português** — identificadores, comentários e UI. Mantenha.
- **Sem `dark:` do Tailwind.** O tema tem três estados (claro, escuro,
  automático) e o `dark:` só enxerga a preferência do sistema, ignorando o
  botão de alternância. Use os **tokens semânticos** de
  [`src/app/globals.css`](src/app/globals.css): `fundo`, `superficie`,
  `superficie-2`, `borda`, `borda-forte`, `texto`, `suave`, `tenue`, `acento`,
  `acento-forte`, `acento-texto`, `ok-texto`, `ok-fundo`, `alerta-texto`,
  `alerta-fundo`. Eles já estão definidos para os três casos.
- **Contraste**: o painel foi auditado em WCAG AA (4.5:1). Cuidado com
  opacidade — `text-alerta-texto/80` sobre fundo âmbar mede 3,27:1 e foi
  reprovado. Meça antes de usar cor esmaecida.
- **Clientes Supabase**: `criarClienteServidor()` (anon + cookies, RLS vale) e
  `criarClienteAdmin()` (service_role, **ignora RLS**) em
  [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts). O admin **nunca**
  pode ser importado em código que rode no navegador.
- **Autenticação**: use `getUser()`, nunca `getSession()` — o segundo só lê o
  cookie e pode ser forjado.

### Storage

Bucket `produtos`, **público para leitura, sem política de escrita**. Upload só
pelo servidor com `criarClienteAdmin()`, depois de conferir a sessão. As fotos
são convertidas para WebP no navegador antes de subir
([`src/lib/imagem.ts`](src/lib/imagem.ts)); `next.config.ts` já libera o host e
sobe o limite de body das Server Actions para 10 MB.

Todos os **556 produtos têm foto**.

---

## 7. O que o catálogo precisa construir

Nada disso existe hoje — `src/app/page.tsx` é um placeholder.

1. **Listagem** com filtro por categoria/subcategoria/fabricante e busca
   (use `produtos.busca`).
2. **Ficha do produto** com fotos, descrição, grade de tamanhos e preço
   **quando houver login liberado**.
3. **Login do cliente** (Supabase Auth; o Arthur cria o usuário pelo painel —
   não há auto-cadastro com acesso imediato).
4. **Carrinho** — provavelmente estado local/cookie. Se guardar
   `produto_tamanho_id`, saiba que esse id é estável: o painel atualiza a grade
   no lugar, sem recriar linhas.
5. **Fechamento** gravando `pedidos` + `pedido_itens`, respeitando o pedido
   mínimo de `configuracoes.pedido_minimo_valor`.
6. **E-mail** (§5).

Onde o catálogo encosta no painel, e pode precisar que ele seja complementado:

| Se o catálogo precisar de… | O painel hoje |
|---|---|
| cliente se cadastrar sozinho | só o Arthur cria cliente; falta tela/fluxo de solicitação |
| cliente ver o próprio pedido | proibido por decisão do cliente (§4) |
| estoque / disponibilidade | **não existe** coluna de estoque em lugar nenhum |
| frete ou CEP | não existe |
| cupom / desconto | `pedidos.desconto` existe mas nenhuma tela usa |

---

## 8. Migrações

`db/schema.sql` é a fonte de verdade e já reflete tudo. As migrações em
`db/migracoes/` são o histórico incremental, **todas aplicadas em produção**
(a 009 entra junto com o deploy da rodada backend — ver DEPLOY.md):

| # | O quê |
|---|---|
| 001 | vocabulário: `embalagens` → `kits`, `qtd_pacotes` → `qtd_kits` etc. |
| 002 | `clientes.legado_id` como constraint (não índice parcial — `ON CONFLICT` rejeita) + política de config pública |
| 003 | `precos_visiveis` passa a distinguir preço próprio de herdado |
| 004 | `clientes.cadastrado_em` — data real de cadastro vinda do legado |
| 005 | **segurança**: papel do usuário novo só via `raw_app_meta_data` (antes, qualquer signup podia nascer admin) |
| 006 | enum `app_role` ganha `colaborador` (roda sozinha, fora de transação) |
| 007 | `is_equipe()` + SELECT em `pedidos`/`pedido_itens` para a equipe |
| 008 | `mudar_status_pedido()`: colaborador muda SÓ a situação do pedido, com log |
| 009 | `link_senha_liberado()`: trava de 60 s por e-mail para o link de senha |

Não há CLI de migração: o SQL é rodado à mão no SQL Editor do Supabase.
Escreva migração nova como arquivo numerado, dentro de `begin; ... commit;`.

**Ao escrever SQL para este banco**: `VALUES` entrega literais como `text`.
Comparar com coluna `date` exige `::date` explícito, ou o Postgres recusa com
`operator does not exist: date = text`.

---

## 9. Como mexer com segurança

**Regenerar os tipos** depois de qualquer mudança de schema. Não há `psql`
instalado nesta máquina apontando para o Supabase, então sobe-se um Postgres
descartável a partir do `schema.sql`:

```bash
docker run -d --name pg-tipos -e POSTGRES_PASSWORD=x -p 55433:5432 postgres:16
# espere a porta TCP: o servidor temporário do initdb responde no socket e
# causa corrida se você testar por lá
until docker exec pg-tipos psql -h 127.0.0.1 -U postgres -c "select 1"; do sleep 0.5; done
docker exec -i pg-tipos psql -h 127.0.0.1 -U postgres <<'SQL'
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create role anon; create role authenticated; create role service_role;
SQL
docker cp db/schema.sql pg-tipos:/schema.sql
docker exec pg-tipos psql -h 127.0.0.1 -U postgres -f /schema.sql
npx supabase gen types typescript --db-url "postgresql://postgres:x@localhost:55433/postgres" \
  > src/lib/supabase/tipos.ts
docker rm -f pg-tipos
```

Os tipos gerados já pegaram três bugs reais (comparação de string com número
em filtro, `null` não tratado). Vale o incômodo.

**Antes de dar por pronto**: `npx tsc --noEmit` e `npx eslint src
--max-warnings 0` — e depois **abra a tela**. Compilar não é funcionar. Neste
projeto já aconteceu de tudo compilar e a tela dar 500 (arquivo `"use server"`
exportando um objeto), e de o HTML estar correto com o elemento invisível
(barra de gráfico com altura em `%` dentro de flex, que não tem de quem
herdar).

---

## 10. Riscos conhecidos da virada

O sistema antigo **ainda está no ar** e recebendo pedidos. Antes do corte:

1. **Reimportar depois que o Arthur mexer no painel quebra.** Se ele adicionar
   um tamanho pela tela, uma reimportação do legado bate em
   `unique (produto_id, tamanho_id)`. Combine uma janela: ou ele não mexe até o
   corte, ou a reimportação é feita com cuidado manual.
2. **Linhas criadas pelo painel não têm `legado_id`**, e a importação casa por
   ele. Mesma janela resolve.
3. **SPF/DKIM** (§5) e **Supabase Pro** (~US$ 25/mês) precisam estar de pé
   antes de receber tráfego real.

---

## 11. Verificações já feitas — não precisa refazer

- Os **698 pedidos** migrados: totais recalculados pelo banco batem com o
  sistema antigo, um a um.
- Os **1.825 clientes**: `cadastrado_em` confere ano a ano com o legado
  (2017: 169 … 2026: 57).
- **Ciclo de acesso do cliente** testado ponta a ponta com usuário real: criar
  login → passa a ver preço → **não** consegue ler pedido nenhum → só enxerga o
  próprio cadastro → suspender preço → revogar acesso.
- **Vazamento de preço**: confirmado que a trava de coluna fecha o buraco, e
  confirmado que a tentativa anterior (revoke só de coluna) *não* fechava.
- **16 telas do painel**: carregam sem erro de console, e o guard de sessão
  redireciona todas para o login preservando o destino.

---

## 12. Papéis do painel: admin e colaborador

Pedido do cliente (out/2026): funcionários que consultam pedidos sem mexer no
resto. `profiles.role` ∈ `admin` · `colaborador` · `cliente`.

| | admin | colaborador |
|---|---|---|
| Pedidos: lista e ficha | ✓ | ✓ — cliente exibido pelo `snapshot_cliente` |
| Mudar a situação do pedido | ✓ | ✓ — via `mudar_status_pedido()`, com log |
| Anotações internas, confirmar vínculo | ✓ | só lê as anotações |
| Clientes, produtos, cadastros, configurações, equipe, início | ✓ | redireciona para Pedidos |

**Onde cada camada decide** — leia antes de criar tela ou action nova:

- **Banco (a proteção de verdade).** `is_equipe()` dá SELECT em `pedidos` e
  `pedido_itens`; NADA de `clientes` (por isso o snapshot). A única escrita do
  colaborador é a função `mudar_status_pedido` — política de UPDATE não
  serve: trava de coluna vale por papel do banco, e admin e colaborador são
  ambos `authenticated`.
- **Server Actions.** O layout do painel **não protege action** — ela é um
  endpoint próprio, chamável por qualquer sessão (inclusive de lojista). Toda
  action nova começa com `exigirAdmin()` (ou `exigirEquipe()`, se o
  colaborador também usa) de `src/lib/sessao.ts`. Isso já furou uma vez:
  `subirFoto`/`excluirFoto` só checavam sessão e usavam service_role no
  Storage — lojista logado apagava foto de produto.
- **Telas.** Seção só de admin tem um `layout.tsx` de três linhas com
  `exigirAdminPagina()` (ver `produtos/layout.tsx`). O menu esconde o resto.

**Criar colaborador:** painel → Equipe. O GoTrue grava o `app_metadata` num
UPDATE *depois* do insert, então o gatilho `handle_new_user` sempre cria o
profile como `cliente`; quem promove é `criarColaborador`, com a service_role.
**Promover alguém a admin** continua sendo feito à mão no banco, de propósito:
`update profiles set role = 'admin' where id = …`.

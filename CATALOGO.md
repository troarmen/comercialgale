# Catálogo do cliente — o que foi construído

Complemento do [PAINEL.md](PAINEL.md). O painel documenta o admin; este
documento explica o catálogo público (`/`), construído em cima do mesmo banco,
das mesmas travas e dos mesmos tokens de tema — sem tocar em nada do painel.

## 1. Mapa de rotas

| Rota | O quê |
|---|---|
| `/` | vitrine: hero, categorias, lançamentos, marcas, como funciona, história |
| `/produtos` | catálogo completo, busca (`?busca=`), filtro de marca e ordenação |
| `/produtos/[categoria]` | página de categoria, com chips de subcategoria |
| `/produtos/[categoria]/[sub]` | página de subcategoria |
| `/produto/[slug]` | ficha do produto: galeria, grade de compra, relacionados |
| `/lancamentos` | produtos com `lancamento = true` |
| `/marcas` · `/marcas/[slug]` | índice alfabético e vitrine por fabricante |
| `/empresa` · `/contato` | institucional (texto real do site antigo) |
| `/cadastro` | solicitação de cadastro → `clientes` com status `incompleto` |
| `/entrar` · `/conta` | login do lojista (Supabase Auth) e ficha do próprio cadastro |
| `/carrinho` | grade do pedido, pedido mínimo e fechamento |
| `/sitemap.xml` · `/robots.txt` | gerados do banco (`src/app/sitemap.ts`, `robots.ts`) |

Não existe "meus pedidos" — decisão registrada no PAINEL.md §4. A tela `/conta`
explica isso ao cliente em vez de esconder.

## 2. Endereços do site antigo (301)

O site de 2013 usava IDs numéricos. O `src/proxy.ts` intercepta os padrões
antigos e devolve **301 de verdade** resolvendo pelo `legado_id` (uma consulta
REST só quando a URL casa com o padrão — navegação normal não consulta nada):

| Antigo | Novo |
|---|---|
| `/produto/1860/cueca_boxer_adulto` | `/produto/cueca-boxer-adulto-albe` |
| `/produtos/47/lingerie` | `/produtos/lingerie` |
| `/produtos/47/11/tangas adultos` | `/produtos/lingerie/tangas-adultos` |
| `/cliente/login` · `/cliente/cadastro` · `/pesquisa` | redirects fixos no `next.config.ts` |

As rotas de página têm o mesmo resolvedor como retaguarda (ID legado morto cai
em not-found com `noindex`).

## 3. Preço: onde o catálogo encosta na trava

- Vitrines e ficha só leem preço da view **`precos_visiveis`** — visitante e
  cliente suspenso recebem zero linhas e a interface vira convite de cadastro.
- O carrinho (localStorage, chave `gale:carrinho`) **não guarda preço**; a tela
  reconsulta o servidor, e o **fechamento refaz os preços pela view com a
  sessão do cliente** (`src/app/(catalogo)/carrinho/acoes.ts`). O navegador
  nunca dita valor.
- A gravação de `pedidos`/`pedido_itens` usa o cliente admin porque `pedidos`
  não tem SELECT para cliente (não daria para ler o `id` de volta) — mas só
  depois de validar sessão, `status = 'ativo'`, `pode_ver_precos` e pedido
  mínimo. `snapshot_cliente` e as cópias congeladas dos itens seguem o esquema.
- O gatilho `t_pedido_numero` numera o pedido (o insert manda `numero: null`
  com cast — o tipo gerado não enxerga gatilho).

## 4. E-mail de pedido

`src/lib/email.ts` (nodemailer). Envia a confirmação ao cliente e cópia para
cada endereço em `configuracoes.emails_notificacao` (lida com service role —
a chave não é pública). **Falha de e-mail não desfaz pedido** — é logada.

Variáveis: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`/`SMTP_SENHA` (opcionais — um
relay autorizado por IP dispensa), `EMAIL_REMETENTE`. Em desenvolvimento, o
Supabase local expõe um Mailpit (SMTP `127.0.0.1:54325`, UI `:54324` — o
`smtp_port` foi habilitado em `supabase/config.toml`).

**Pendências fora do código** (já apontadas no PAINEL.md §5): SPF/DKIM do
domínio e um SMTP de produção.

## 5. Cadastro de lojista

`/cadastro` grava direto em `clientes` com `status = 'incompleto'` via service
role (a tabela não tem INSERT para anon, de propósito — o formulário é a única
porta e valida no servidor). Honeypot contra robô; documento duplicado recebe
mensagem amigável em vez de duplicar. A solicitação aparece no painel em
Clientes, onde o Arthur aprova e cria o login — fluxo que o painel já tem.

## 6. SEO

- `title`/`description` únicos por página; canônica em todas; `noindex` em
  busca, filtros, sessão (`/entrar`, `/conta`, `/carrinho`).
- JSON-LD: `Organization` + `WebSite` (layout), `BreadcrumbList` e `ItemList`
  nas vitrines, `Product` na ficha — **sem `offers`**: preço é restrito a
  logado e não vaza em dado estruturado.
- Sitemap com as 650+ URLs reais (fixas + categorias + subcategorias + marcas
  com produto + produtos ativos, `lastmod` do `updated_at`).
- Paginação com `<a>` de verdade (`rel` prev/next), chips de subcategoria como
  links — nada de listagem atrás de botão.
- `NEXT_PUBLIC_SITE_URL` define o endereço canônico (produção:
  `https://www.comercialgale.com.br`).

## 7. Decisões de interface

### Camada visual (revisão de 23/08, segunda passada)

- **Logotipo oficial** (`public/logo-gale.png`, baixado do site atual, com
  transparência) no cabeçalho, rodapé e gaveta móvel; favicon e `icon.png`
  recortados do coração por máscara de croma. No tema escuro o token
  `--logo-placa` pinta uma placa branca atrás do arquivo (o texto do logo é
  carvão e sumiria).
- **Paleta clean**: fundo branco-gelo (`#f6f7f9`), cartões brancos, bordas
  `#eaedf1`, cinzas frios; o vermelho da marca ficou só em CTA, selo e
  destaque. Tudo via tokens do `globals.css`.
- **A loja é SEMPRE clara**: o layout do catálogo fixa `data-tema="claro"`
  antes da primeira pintura — modo escuro do sistema do visitante não escurece
  a vitrine (decisão de marca, 23/08). O alternador saiu do rodapé da loja; o
  painel `/admin` mantém claro/escuro/auto normalmente. Detalhe: navegação
  client-side loja→painel carrega o painel claro até um recarregamento.
- **Escala de sombras** em `@theme`: `shadow-pousada` (repouso),
  `shadow-suave` (painéis), `shadow-flutuante` (hover/dropdown/menu),
  `shadow-cta` (botão primário, tingida de vermelho).
- **Fundos decorativos** (`src/components/catalogo/decorativos.tsx` + classes
  `fundo-grade`/`fundo-pontos`/`flutua` no CSS): grade modular, pontos de
  distribuição e "caixas" flutuantes em baixa opacidade — CSS puro pintado com
  `color-mix` sobre os tokens (acompanha o tema), animações só de
  transform/opacity e desligadas por `prefers-reduced-motion`.
- **Hero**: composição de três fotos reais em cartões rotacionados
  (empilhamento = volume), selos flutuantes e régua de números reais
  (48+ anos · produtos ativos contados no banco · marcas).
- **Microinterações**: cartões elevam no hover com "Ver produto →", mega menu
  desliza ao abrir, chips/pills ganham sombra, linha tracejada liga os passos
  do "como funciona".

- **Enquadramento das fotos** (24/08): medidas as 556 fotos do legado, 87% são
  QUADRADAS (mediana 1:1; extremos 0,52 e 2,45). As molduras 3:4 com
  `object-cover` cortavam ~25% de quase toda foto. Regra agora, em todo lugar
  onde produto aparece (cartão, galeria e miniaturas, hero, categoria,
  carrinho): moldura `aspect-square` branca + `object-contain` com margem
  interna (`p-2`…`p-4`). Foto nunca é cortada, em nenhuma largura; a que não é
  quadrada ganha faixas brancas que somem no fundo branco do estúdio. O zoom
  do hover caiu para 1,02 para não encostar na borda.

### Rodada de feedbacks do cliente (17/10/2026) — escopo frontend

- **Mínimo de R$ 500 virou AVISO**: o bloqueio saiu do `fecharPedido` e do
  botão. O carrinho mostra a faixa âmbar "compras no atacado são a partir de
  R$ 500" quando o total está abaixo, mas o pedido FECHA (verificado de ponta
  a ponta: pedido local nº 2026100001001, R$ 93). `pedido_minimo_valor` segue
  sendo o valor de referência do aviso.
- **Nomenclatura oficial: "Atacado" e "Varejo"** — "revenda sugerida"/"preço
  sugerido" foram extintos da UI. O Varejo aparece ao lado do Atacado no
  cartão, na grade da ficha e no carrinho, sempre atrás de
  `exibir_preco_varejo`.
- **"Embalagem com X peça(s)"** substituiu "kit" em TODA copy visível
  (ficha, grade, cartões, carrinho, e-mail, aria-labels). Os identificadores
  internos (`qtdKits`, `pecas_no_kit`…) não mudam — são o vocabulário do
  banco (PAINEL.md §2).
- **Carrinho em TABELA, sem foto** (pedido do cliente): colunas Produto/Ref/
  Marca, Tam., Emb. c/, Qtd, Atacado+Total, Varejo+Total, remover; totais no
  rodapé; rolagem horizontal no celular. Visitante vê a tabela sem colunas de
  preço. O item do carrinho ganhou campo opcional `marca`.
- **Validade do carrinho**: localStorage com carimbo `salvoEm`; expira só após
  90 dias sem mexer (formato antigo, array puro, continua sendo lido). Não há
  mais perda por "sessão" — a nota na tabela explica isso ao lojista.
- **Logo 50 anos** (`public/logo-gale.png`, 919×851 com transparência; fundo
  #f7f7f7 removido por floodfill) no cabeçalho/rodapé/gaveta; favicon e
  coração regenerados da arte nova.
- **Home reorganizada** (padrão e-commerce dos concorrentes indicados):
  banner enxuto (fotos fixas `HERO_SLUGS` do painel preservadas, com
  fallback) → mini banners → prateleira de produtos na primeira dobra →
  categorias → marcas → como comprar → história. A prateleira usa lançamentos
  QUANDO existem e cai para destaques — em produção `lancamento=false` em
  todo o catálogo (migração não trouxe a flag; ver nota no código).

**Fora desta rodada (backend, próxima)**: e-mails de confirmação não chegam
(SMTP de produção nunca configurado + SPF/DKIM — §4 deste doc); login
restrito para colaboradores verem pedidos sem editar (novo papel no painel +
políticas RLS — decisão de modelagem com o painel).

### Demais decisões

- **Grade de compra B2B**: na ficha, cada tamanho tem contador de kits e um
  botão único manda tudo — lojista compra grade, não peça. Preço por kit e por
  peça lado a lado; revenda sugerida como referência de margem (respeita
  `exibir_preco_varejo`).
- Carrinho local (localStorage + `useSyncExternalStore`, mesmo desenho do
  tema). A chave do item é `produto_tamanho_id` — estável, como documenta o
  PAINEL.md §7.
- Mesmos tokens de tema do painel, mas a loja é fixada no claro (ver "Camada visual" acima).
- Estados cobertos: esqueletos (`loading.tsx`), busca vazia, categoria vazia,
  item que saiu do catálogo dentro do carrinho, conta aguardando liberação,
  erro (`error.tsx`), 404 com navegação.
- Menu móvel é um portal no `body` — o cabeçalho usa `backdrop-blur`, e
  `backdrop-filter` num ancestral prende qualquer `fixed` lá dentro (bug real
  encontrado no teste).

## 8. Ambiente local de desenvolvimento

Sem acesso ao Supabase de produção, o fluxo local completo é:

```bash
npx supabase start                       # sobe Postgres+Auth+Storage+Mailpit
docker exec -i supabase_db_comercialgale psql -U postgres < db/schema.sql
# grants padrão do Supabase hospedado + REAPLICAR a trava de coluna (§8 do schema)
# criar bucket público `produtos`
python3 scripts/extrair_legado.py produtos && python3 scripts/extrair_legado.py imagens
python3 scripts/importar_catalogo.py
npm run dev
```

`.env.local` aponta para as chaves demo do CLI. Detalhe do psql local: aplicar
`schema.sql` "na unha" não cria os grants que o Supabase hospedado dá por
padrão (`service_role` etc.) — ao concedê-los, **refazer o revoke+grant de
coluna do §8**, senão o preço reabre.

## 9. Achado na extração (para a migração real)

`extrair_legado.py` gravou `lancamento: false` para os 556 produtos, mas o
site atual tem **180 lançamentos** (o grid do admin não devolve
`IS_LANCAMENTO` como o script espera). Antes da importação de produção, vale
corrigir o extrator ou repetir o contorno usado aqui: o endpoint público
`POST /controller/produto/loadlist` com `isl=1` lista os lançamentos e o
`legado_id` deles permite o `update` em lote.

## 10. Verificado de ponta a ponta (local)

- Visitante: preço não sai nem por REST direto (`?select=preco_atacado` → 403;
  view → `[]`), cartões mostram convite de cadastro.
- Lojista de teste: login → grade com preço (kit R$ 35,40 ÷ 12 = R$ 2,95/peça,
  confere) → carrinho → **pedido mínimo bloqueia abaixo de R$ 500** → pedido
  `2026080001000` gravado com totais recalculados pelo gatilho (R$ 620 / 40
  peças), itens congelados, e-mail no Mailpit, carrinho limpo.
- Cadastro público grava `incompleto`; duplicado é barrado com mensagem.
- 301 dos três padrões legados; sitemap com 657 URLs; robots ok; build de
  produção limpo (`next build`), `tsc --noEmit` e `eslint --max-warnings 0`.

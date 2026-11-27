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
| `/esqueci-senha` · `/definir-senha` | pedir link por e-mail; criar/trocar a senha (lojista e equipe) |
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

## 4. E-mails

`src/lib/email.ts` (nodemailer, texto simples). **Falha de e-mail nunca
desfaz nada** — pedido e cadastro já estão no banco; o erro é logado.

| Quando | Para quem | Onde dispara |
|---|---|---|
| Pedido fechado | lojista + `emails_notificacao` | `carrinho/acoes.ts` |
| Cadastro enviado | lojista ("recebemos") + `emails_notificacao` ("novo cadastro para aprovar", com link para a ficha; responder cai no lojista) | `cadastro/acoes.ts`, via `after()` — o lojista não espera o SMTP |
| Arthur cria o login | lojista: "acesso liberado" + link para criar a senha | painel, `clientes/[id]/acoes.ts` |
| Arthur cria colaborador | colaborador: convite + link | painel, `equipe/acoes.ts` |
| "Esqueci minha senha" / reenvio pelo painel | quem pediu | `/esqueci-senha`, painel |

**Links de senha** (`src/lib/links-senha.ts`): `generateLink` + link
próprio para `/definir-senha?token_hash=…`. Três decisões não óbvias:

- **Não usamos `resetPasswordForEmail`**: com PKCE, o link só abriria no
  navegador de quem pediu (o do Arthur, quando o pedido sai do painel).
- **Abrir o link não gasta o token** — só o envio do formulário. Filtros de
  e-mail corporativo (Outlook Safe Links) abrem os links para inspecionar; se
  a abertura consumisse o token, o lojista receberia "link expirado".
- **Trava de 60 s por e-mail** (migração 009): o `generateLink`, ao
  contrário do reset do Supabase, não tem limite próprio — sem trava, dava
  para inundar a caixa de um lojista.

`/esqueci-senha` responde igual com ou sem conta (não revela quem é cliente).

Variáveis: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`/`SMTP_SENHA`,
`EMAIL_REMETENTE` e `URL_LINKS_EMAIL` (base dos links; cai no
`NEXT_PUBLIC_SITE_URL` se ausente — ver DEPLOY.md §2). Produção:
**Brevo** — passo a passo em [DEPLOY.md](DEPLOY.md). Em desenvolvimento, o
Supabase local expõe um Mailpit (SMTP `127.0.0.1:54325`, UI `:54324`).

## 5. Cadastro de lojista

Desde nov/2026 (pedido do cliente, item 11): `/cadastro` pede também uma
senha, valida CPF/CNPJ (inclusive o CNPJ alfanumérico de 2026), cria a ficha
e o login com a service role e **entra na hora** → `/cadastro/bem-vindo`, já
com preço. E-mails: boas-vindas ao lojista e aviso à casa (`emails_notificacao`).
- Interruptor **Configurações → Liberar cadastro automaticamente**
  (`cadastro_aprovacao_automatica`; ausente = ligado; erro de leitura =
  desligado). Desligado: o login nasce, mas a ficha fica `incompleto` sem preço
  até a equipe ativar.
- **Ficha que já existe** (mesmo documento): com login → "use Esqueci minha
  senha"; sem login e e-mail digitado IGUAL ao da ficha → cria o login sem
  senha e manda o link de criar senha para esse e-mail (prova de posse; a senha
  digitada é descartada); e-mail diferente, ficha inativa, preço suspenso ou
  acesso revogado (registro em `log_atividades`) → WhatsApp da equipe.
- Contra robô: honeypot + carimbo de tempo assinado (mín. 3 s, máx. 2 h) +
  dígitos do documento. **Não há limite por IP** (sem infraestrutura).

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
  banner enxuto (hoje a arara 3D, ver §13) → mini banners → prateleira de produtos na primeira dobra →
  categorias → marcas → como comprar → história. A prateleira usa lançamentos
  QUANDO existem e cai para destaques — em produção `lancamento=false` em
  todo o catálogo (migração não trouxe a flag; ver nota no código).

**Rodada backend (18/10/2026)**: e-mails (§4 deste doc + DEPLOY.md) e papel
colaborador no painel (PAINEL.md §12).

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

## 11. Fundos com vermelho (18/10/2026) — onde cada camada entra

Pedido: mais tons de vermelho e vida nas faixas gelo, sem empilhar camadas.
A alocação passou por um julgamento por seção (Jev) e por decisão nossa:

- **Hero da home**: era o fundo líquido WebGL; saiu em 16/11/2026 (ver §13).
- **Como comprar**: `.fundo-aurora-espelhada` + `PadraoPontos tom="marca"`.
- **Páginas internas**: `.halo-topo` no `<main>` (pseudo-elemento, z-index
  negativo em contexto isolado) — halo de 22rem atrás do título.
- **Não recebem nada**: prateleira, carrinho, rodapé, formulários — Jev e nós
  concordamos: fundo em movimento atrás de preço, tabela ou campo atrapalha.

Regras: vermelho de fundo sempre diluído (≤ 13% em CSS) — exceto o topo da
home, mais quente desde 16/11 (§13); nunca canvas acima de conteúdo
clicável. O three.js saiu do projeto junto com o fundo líquido.


## 12. Rodada de alterações do cliente (16/11/2026)

Relatório "Site de Atacado Galé — Alterações solicitadas" (Arthur), 13 itens:

| # | Pedido | Onde ficou |
|---|---|---|
| 1 | Busca não achava "Izitex" | `src/lib/busca.ts` (catálogo e painel) |
| 2 | Produto perdia categoria e kit ao salvar | reset de formulário do React 19 → `useEnvio` em `src/components/cadastro-ui.tsx` (produto, cliente, cadastros) |
| 3 | Negrito na descrição | `**trecho**` + `src/lib/descricao.tsx`; recuperar o antigo: `scripts/recuperar_negrito.py` (precisa do painel antigo no ar) |
| 4 | E-mail do pedido em tabelas | `src/lib/email.ts` (Atacado e Varejo, < 60 KB com 80 linhas) |
| 5 | Lista de produtos: cadastro, lançamento, ordenação, lote | `admin/(painel)/produtos/page.tsx` + migração 010 (datas do legado) |
| 6 | Lista de clientes: data de cadastro | `admin/(painel)/clientes/page.tsx` |
| 7 | Duplicar produto | `/admin/produtos/novo?de=<id>` (sem fotos; ref. nova obrigatória) |
| 8 | Botão Voltar com a lista como estava | `src/components/voltar.tsx` |
| 9 | Banners em loop no topo | tela **Vitrine** + `topo-banners.tsx` (ver §14); sem banner ativo = banners padrão |
| 10 | Trocar o logo | tela **Vitrine** |
| 11 | Cadastro com aprovação automática | §5 |
| 12 | A–Z pela marca | `listarProdutos` ordem `nome` = `fabricantes(nome)` |
| 13 | Zoom na foto | `visualizador-foto.tsx` (fotos são 800×800: zoom acima disso perde nitidez) |

Login LOCAL de admin para QA (só no Supabase local): `admin@teste.local` /
`gale-admin-local-2026`.

## 13. Topo da home: arara 3D (16/11/2026) — SUBSTITUÍDA pelos banners (§14)

Pedido: fundo do topo mais rosado, sem as ondas que seguiam o mouse, e as
três peças do topo com visualização de 180–360°. Ficou no ar de 16 a 17/11;
o cliente preferiu banners (§14) e o componente saiu. Seguem valendo: o
`.fundo-hero`, a saída do fundo líquido/`three` e o SEO da home.

- **Fundo**: `.fundo-hero` em CSS puro (base rosa em degradê, halos de
  gale-500/gale-400 mais fortes e uma luz clara atrás da arara). O fundo
  líquido (`fundo-liquido*.tsx`) e a dependência `three` foram removidos.
- **Arara**: `src/components/catalogo/arara-3d.tsx` + bloco `.arara-*` no
  `globals.css`. CSS 3D, sem WebGL: cada peça é um recorte transparente
  empilhado em 6 camadas (frente, miolo escuro que vira a espessura de lado,
  costas espelhadas e um tom abaixo). O catálogo só tem foto de frente, então
  as costas são essa aproximação. Arrastar (mouse ou dedo, `touch-action:
  pan-y` para não travar a rolagem) gira livre; soltou, segue no embalo e
  volta de frente depois de ~2,6s. Clique sem arrasto abre a ficha; setas do
  teclado giram 45°. Uma volta de apresentação na peça do meio quando a arara
  aparece; nada automático com `prefers-reduced-motion`.
- **Peças** (constante `ARARA` em `src/app/(catalogo)/page.tsx`): Sutiã
  Blue Rose 9189, Camisola Desafio 02 e Cueca Boxer Dom Marco 8520 — três
  lançamentos de categorias diferentes, fotografados soltos em fundo branco
  (os que recortam bem) e em cores que conversam com o rosa. Substituem o
  antigo `HERO_SLUGS`. Peça que sair do ar some da arara; com banner ativo
  na Vitrine, a arara nem é montada.
- **Recortes**: o script virou `scripts/recortar_peca.py` e os recortes
  foram para `design/banners-padrao/pecas/` (usados nos banners padrão).
- **SEO da home**: título `Atacado de Lingerie e Moda Íntima em SP | Comercial
  Galé` (56 caracteres, 530px; o anterior tinha 715px e saía cortado) e
  descrição de 137 caracteres / 893px, medidos em Arial como o Google desenha.
  O mesmo título virou o `default` do layout.
- **Medido** (build de produção, iPhone 13 emulado, 4G lento + CPU 4×, sem
  cache): FCP/LCP 0,8s (o LCP é o h1), CLS 0, ~430 KB no total; sem rolagem
  lateral de 320 a 1440px. Os três recortes somam 73 KB.
- **Ajustes do cliente (16/11)**: a arara recua do h1 e fica centralizada na
  coluna (respiro `lg:pl-8 lg:pr-6 xl:pl-20 xl:pr-12`); o trilho termina logo
  depois das peças no desktop; o texto do topo não mostra mais o número de
  produtos.

## 14. Topo da home: banners do painel (17/11/2026)

Decisão do cliente (Arthur, 17/11): o topo vira banner, para a equipe
personalizar por produto e por estação; por ora, um banner genérico por
categoria, sem promoção. Pedido nosso: o h1 não muda e continua texto no HTML.

- **Componente**: `src/components/catalogo/topo-banners.tsx` (substitui
  `carrossel-banners.tsx` e `arara-3d.tsx`). O texto do topo (eyebrow, h1,
  chamada, botões) é renderizado no servidor em `page.tsx` e entra como
  `children`; o componente só põe os banners em volta. Antes, com banner, o
  h1 virava `sr-only` — agora é sempre visível.
- **Arranjos**: até 1023px, texto e embaixo o quadro quadrado (imagem de
  celular; sem ela, recorte do lado direito da de computador,
  `object-[88%_50%]`); 1024–1279px, texto à esquerda e o quadro à direita;
  ≥1280px, o banner 3:1 é o fundo do topo inteiro com o texto por cima, um
  véu rosa (`.topo-banners-veu`) sob o texto e, acima de 1920px, a arte
  centralizada com as laterais esmaecendo (`.topo-banners-faixa`).
- **Carrossel**: troca por esmaecimento a cada 6s; pausa com mouse em cima,
  foco de teclado, aba oculta e `prefers-reduced-motion`; botão de pausa,
  setas, pontinhos, deslizar no celular; slides fora de vista `inert`.
- **Banners padrão**: `BANNERS_PADRAO` em `src/lib/vitrine.ts` — Lingerie
  (→ `/produtos/lingerie`) e Cuecas (→ `/produtos/cuecas`), arquivos em
  `public/banners/`. Entram sempre que o painel não tem banner ATIVO (também
  se a leitura da vitrine falhar), então não dependem de nada no banco de
  produção. O painel mostra os dois como "no ar agora"/"guardados".
- **Gerar/alterar os padrão**: molde `design/banners-padrao/banner.html`
  (mesmo degradê do `.fundo-hero`, arara com cabides, selo da categoria) e
  `design/banners-padrao/gerar.mjs` (`MODULOS=<pasta com puppeteer-core>
  node design/banners-padrao/gerar.mjs`). Regra da arte de computador: metade
  esquerda livre (é onde o h1 fica), produtos entre 55% e 97% da largura e
  ~70px de folga em cima e embaixo (cortados em telas ≥1920px).
- **Painel**: a tela Vitrine explica a regra da metade esquerda, marca a
  "área do título" na prévia da imagem de computador e lista os padrão.
- **Medido** (build de produção, iPhone 13, 4G lento + CPU 4×, sem cache):
  FCP 0,7s, LCP 1,5s (a imagem do banner), CLS 0; sem rolagem lateral de 768 a
  2560px e no iPhone; troca automática, setas e clique na arte conferidos.

## 15. Rodada de alterações do cliente (24/11/2026)

Relatório "Alterações 24.11" (Arthur). O que ficou em cada item:

| # | Pedido | O que foi feito |
|---|---|---|
| 1.1 | Datas de cadastro do site antigo | Migração 010 — o Tro rodou em produção em 24/11 (commit `1cccfca`). |
| 1.2 | Marcação "Lançamento" do antigo | Migração **011** (aplicada em 27/11: 185 marcados, 204 no total): liga os 185 lançamentos do site antigo, lidos em 27/11 (o servidor antigo ainda responde pelo IP 191.6.218.131 com `Host: www.comercialgale.com.br`). Só liga, nunca desliga. |
| 1.3 | Organizar por lançamento no painel | Produtos: coluna "Lançamento" ordenável (marcados primeiro, os mais novos no topo) e atalho **Lançamentos (N)** no cabeçalho; desmarcar pela caixa da linha ou em lote (já existiam). |
| 2.1 | Ordem "aleatória" nas categorias | Padrão da vitrine: lançamentos → marca → nome → referência, e `id` como desempate em toda ordem (sem ele, empates trocavam de lugar e de página). |
| 2.2 | Marcas fora de ordem no filtro | Filtro da vitrine em A–Z (`localeCompare` pt-BR); as listas dos filtros do painel também. A home e /marcas seguem por quantidade de produtos. |
| 3.1 | Preço da variação "enchendo os decimais" | `grade.tsx` guardava número e redesenhava "1,00" a cada tecla; agora guarda o texto e só formata ao sair do campo. |
| 3.2 | Dom Marco 8747 | Não existe produto ATIVO com essa referência em produção nem na extração do site antigo. Sem acesso ao banco de produção, ficou a consulta de diagnóstico para o Tro (ver relatório da rodada). |
| 3.3 | Excluir produto descontinuado | O botão existia, mas travava em produto que já foi pedido. Liberado: `pedido_itens` guarda cópia de nome/ref./preços e a FK é `on delete set null` — o pedido mostra o item como "fora do catálogo". |
| 4.1 | "Varejo — revenda sugerida" e margem | Rótulo "Varejo", sem margem. Textos do site, carrinho, e-mails e Configurações trocados para a definição do cliente (Varejo = compras abaixo do pedido mínimo, ou quem prefere o Varejo). Cálculo de preço não mudou. |
| 5.1 | E-mail de boas-vindas | Já existia (rodada de 16/11) e sai pelo Brevo; agora fica registrado na ficha do cliente. |
| 5.2 | Busca de pedidos pelo cliente | Só buscava pelo número. Agora: número, nome/fantasia/e-mail/CPF-CNPJ do cadastro e o nome congelado no pedido, sem acento. |
| 5.3 | Convite para quem não criou senha | Clientes → **Ainda sem senha** (`/admin/clientes/senhas`): ativos com login que nunca entraram; convite "crie a sua senha no site novo" em lotes de 25 (cota diária do Brevo), sem repetir em 7 dias. |
| 5.4 | E-mail de pedido que não chegou | Dois defeitos: ia para o e-mail da FICHA (em ficha migrada, velho ou com dois endereços) e a tela dizia "enviamos" mesmo sem enviar. Agora vai para o e-mail do login (+ os da ficha), a tela só promete quando saiu, cada envio fica registrado na ficha do pedido e Configurações tem "Enviar e-mail de teste". |


# Mapeamento: sistema antigo → banco novo

Documento de revisão. **Nada foi importado ainda.**
Confere as colunas marcadas com ⚠️ — são as que envolvem decisão ou perda de dado.

---

## 1. Fabricantes → `fabricantes`  (200 registros)

| Legado | Novo | Observação |
|---|---|---|
| `ID` | `legado_id` | mantido para rastrear a origem |
| `TITULO` | `nome` | |
| — | `slug` | gerado a partir do nome |
| `DESCRICAO` | `descricao` | |
| `ORDEM` | `ordem` | |
| status da linha | `ativo` | `1` → true |

---

## 2. Categorias → `categorias`  (6 registros)

Lingerie · Meias · Cuecas · Pijamas · Linha Praia (inativa) · Diversos

Mesmo mapeamento dos fabricantes. Todas com `ORDEM = 999` no legado, ou seja,
**a ordenação nunca foi usada** — no painel novo elas vão aparecer em ordem
alfabética até o Arthur arrastar e definir a dele.

---

## 3. Subcategorias → `subcategorias`  (38 registros)

| Legado | Novo | Observação |
|---|---|---|
| `CATEGORIA` | `categoria_id` | resolvido pelo `legado_id` da categoria |
| `TITULO` | `nome` | |
| — | `slug` | único dentro da categoria |

**Todos os 556 produtos têm subcategoria.** 29 das 38 estão em uso; as 9 vazias
são quase todas da categoria Linha Praia, que está inativa:

> Babydoll e Hobby · Biquínis e Maiôs Adulto · Biquínis e Maiôs Infanto-Juvenil
> · Saídas de Praia · Sungas Adulto · Sungas Infanto-Juvenil · Juvenil · Bebê
> · Outros

Sugestão: importar as 9 mesmo assim (custo zero) e deixar o Arthur decidir se
apaga. Ele pode estar guardando a Linha Praia para reativar na temporada.

Maiores subcategorias: Pijamas Adulto (74) · Sutiãs Adultos (58) ·
Meias Infantis e Bebês (48) · Tangas Adultos (47) · Calças Adultos (44).

---

## 4. Unidades → `kits`  (8 registros)

O legado chama de "Unidade", mas **não é unidade de medida — é o tamanho do
kit fechado**: 1, 2, 3, 4, 5, 6, 10 e 12 peças. O Arthur chama de "kit", e é
esse o nome adotado no sistema novo.

| Legado | Novo |
|---|---|
| `SIGLA` (número) | `pecas` |
| `TITULO` ("6 unidades") | `descricao` |

⚠️ O campo `unidade` do produto guarda o **ID do kit**, não a quantidade.
Ex.: `unidade = 4` aponta para o kit de ID 4, que tem **3 peças**.
Confundir os dois erraria o preço de todo o catálogo.

---

## 5. Opção "Tamanho" → `tamanhos`  (120 registros)

Classificação proposta em [tamanhos.csv](tamanhos.csv), pendente da sua revisão:

| tipo | qtd |
|---|---|
| tamanho | 49 |
| numeração de pé | 38 |
| faixa etária | 19 |
| **cor** | **8** |
| **grade fechada** | **6** |

⚠️ As 8 cores (`TU - Branco`, `TU - nude+marrom`…) foram digitadas no campo de
tamanho por falta de um campo de cor no sistema antigo. As 6 grades
(`4P/4M/4G`) são uma quarta forma de venda que o painel novo precisa exibir de
forma clara.

---

## 6. Produtos → `produtos` + `produto_tamanhos` + `produto_imagens`  (556)

| Legado | Novo | Observação |
|---|---|---|
| `titulo` | `titulo` | |
| `modelo` | `modelo` | é a referência da peça ("MF 307 A") |
| — | `slug` | `titulo + modelo`; ⚠️ 4 colidem, ganham sufixo na importação |
| `descricao` | `descricao` | |
| `tag` (texto com vírgulas) | `tags` (array) | vira array de verdade, pesquisável |
| `categoria` | `categoria_id` | |
| `subcategoria` | `subcategoria_id` | ⚠️ ver armadilha abaixo |
| `fabricante` | `fabricante_id` | |
| `unidade` | `kit_id` | ver aviso da seção 4 |
| `preco_atacado` | `preco_atacado` | ⚠️ **preço do KIT**, não da peça |
| `preco` | `preco_varejo` | ⚠️ idem — revenda sugerida do kit |
| `ncm` | `ncm` | `"0"` vira nulo (nunca foi preenchido) |
| `possui_st` | `possui_st` | |
| `IS_LANCAMENTO` | `lancamento` | |
| status da linha | `ativo` | |

### ⚠️ Armadilha da subcategoria

O `<select>` de subcategoria **vem vazio no HTML** — é preenchido por AJAX
depois que a página carrega. Ler o formulário direto faz parecer que nenhum dos
556 produtos tem subcategoria, o que é falso.

O valor real está na chamada que o próprio formulário dispara ao abrir:

```js
loadCategories('48', '12')   // 48 = categoria (Meias), 12 = subcategoria (Femininas)
```

Caí nessa na primeira extração e reprocessei os produtos por causa disso.
Fica registrado porque qualquer script futuro que leia esse painel vai tropeçar
no mesmo lugar.

### Preço — a regra conferida contra pedidos reais

```
preco_unitario = preco_kit / pecas_no_kit
total_linha    = preco_kit × qtd_kits
```

Verificação: ref. 6000, kit de 3 peças, `preco_atacado = 25,95`.
No pedido 2026080001222 o unitário impresso é **8,65** — e 25,95 ÷ 3 = 8,65. ✅

### Tamanhos do produto → `produto_tamanhos`

| Legado | Novo | Observação |
|---|---|---|
| `s_opcao[46][id]` | `tamanho_id` | |
| `s_preco_atacado[id]` | `preco_atacado` | ⚠️ `0.00` → **nulo** (herda do produto) |
| `s_preco[id]` | `preco_varejo` | ⚠️ idem |

⚠️ No legado, `0.00` é ambíguo: significa "herda do produto", mas é
indistinguível de "de graça". A migração converte para nulo, que é explícito.
Na prática só os tamanhos grandes têm preço próprio — ex. ref. 8005 custa
R$ 31,80 nos tamanhos normais e R$ 40,80 nos 54/56 e 58/60.

### Imagens → `produto_imagens`

Origem: `/arquivos/produto/<arquivo>.jpg` (URL pública, sem autenticação).
Destino: Supabase Storage, convertidas para WebP.

⚠️ **Uma foto por produto** no legado. O banco novo aceita várias; a existente
entra como principal e o Arthur enriquece depois quando quiser.

---

## 7. Clientes → `clientes`  (1.825 registros)

| Legado | Novo | Observação |
|---|---|---|
| `nome` | `nome` | razão social quando PJ |
| `nome_fantasia` | `nome_fantasia` | |
| `documento` | `documento` | ⚠️ só dígitos; **sem restrição de unicidade** |
| `rg` / `IE` | `rg` / `inscricao_estadual` | |
| `data_nasc` | `data_nascimento` | `dd/mm/aaaa` → `date` |
| `email` | `email` | normalizado para minúsculas |
| `telefone1/2/3` | `telefone1/2/3` | os três preservados |
| `nome_contato` | `nome_contato` | |
| `cep`…`pais` | idem | |
| `observacoes` | `observacoes` | anotações internas do Arthur |
| `status` 0/1/2 | `status` | inativo / ativo / incompleto |
| `tipo_pessoa` 0/1 | `tipo_pessoa` | fisica / juridica |
| `tipo_cadastro` 1/2 | `cliente_antigo` | `2` (ANTIGO) → true |
| `tipo_compra` 1/2 | `tipo_compra` | ⚠️ atacado / varejo — **ver pendência** |

### Qualidade real dos dados (medida nos 1.825 extraídos)

| Verificação | Resultado |
|---|---|
| Ativos | 1.821 · Inativos: 4 |
| Pessoa Física / Jurídica | 1.474 / 351 |
| E-mails válidos | **1.823** · 1 vazio · 1 inválido (`styllus confecções`) |
| E-mails repetidos | **0** |
| CPF/CNPJ repetidos | **0** |
| Sem documento | 33 |
| Sem UF / sem telefone | 44 / 33 |
| `tipo_compra` preenchido | **92 de 1.825** (95% em branco) |

Melhor do que o esperado. As duas preocupações que eu tinha levantado
**não se confirmaram**: não há documento duplicado e não há e-mail duplicado.
A restrição de unicidade em `documento` pode ser imposta desde o início — mas
optei por deixar sem, porque 33 cadastros não têm documento nenhum e a regra
travaria a inclusão de novos clientes sem CPF pelo painel.

⚠️ **Senhas não migram.** O legado guarda a senha em campo próprio e não temos
acesso ao banco para ler o hash. Com 1.820 dos 1.821 clientes ativos tendo
e-mail válido, o fluxo de "esqueci minha senha" resolve **99,9%** dos casos.
O único sem e-mail utilizável o Arthur libera manualmente.

⚠️ **`tipo_compra` está vazio em 95% dos cadastros** — 90 marcados como Atacado,
2 como Varejo, 1.733 em branco. É evidência forte de que o campo foi criado e
abandonado. Sugiro descartar, mas é decisão do Arthur.

---

## 8. Pedidos → `pedidos` + `pedido_itens`  (698 registros)

| Legado | Novo | Observação |
|---|---|---|
| `venda` | `numero` | formato `AAAAMM` + 7 dígitos, preservado |
| `cliente` | `cliente_id` | ⚠️ vinculado pelo `legado_id` do cliente |
| `data_cadastro` | `criado_em` | |
| `TOTAL_ATACADO` | `total_atacado` | |
| `TOTAL_VAREJO` | `total_varejo` | |
| status 1/2/3 | `status` | aguardando_pagamento / pago / cancelado |

### Itens

Cada linha do pedido antigo tem 8 colunas; o pedido é impresso **duas vezes**
(atacado e varejo). A extração pareia as duas listas por posição.

| Legado | Novo |
|---|---|
| Descrição | `produto_titulo` |
| Ref. | `produto_modelo` |
| Tamanho | `tamanho` |
| Unidade | `pecas_no_kit` |
| Qtd | `qtd_kits` |
| Vl Kit (atacado) | `preco_kit_atacado` |
| Vl Kit (varejo) | `preco_kit_varejo` |

### Conferência dos 698 pedidos extraídos

| Verificação | Resultado |
|---|---|
| Itens no total | 18.475 |
| Pedidos sem itens | 0 |
| Linhas com conta divergente | **0** |
| Pedidos cuja soma dos itens ≠ total | **0** |

A matemática do kit fecha em **todas as 18.475 linhas**, o que confirma em
definitivo a regra `total = preco_kit × qtd_kits`.

Status no legado: 364 pagos · 315 aguardando pagamento · 11 cancelados ·
⚠️ 8 com status `0` ("desativado"), que não aparece na lista de status de
pedido do painel. Proposta: importar como `cancelado`. Confirmar com o Arthur.

Volume por ano: 2017 (29) · 2018 (59) · 2019 (56) · **2020 (155)** ·
2021 (144) · 2022 (81) · 2023 (62) · 2024 (48) · 2025 (40) · 2026 (24 até agosto).

### Vínculo com o cliente

O pedido antigo só guarda o **nome** do cliente, não o ID. Oito nomes aparecem
em dois cadastros — quase sempre a mesma pessoa registrada como PF e como PJ,
provavelmente para comprar com ou sem nota. Isso afeta 55 pedidos:

| Critério | Resolve |
|---|---|
| Tipo de pessoa registrado no próprio pedido | 26 |
| Cadastro já existia na data do pedido | 3 |
| **Ainda ambíguo** | **26** |

Os 26 restantes são três nomes com dois cadastros PF cada: Daniel (20 pedidos,
dois CPFs em Bragança Paulista), Izilda (4) e Andreia (1). Serão vinculados ao
cadastro mais antigo e marcados com `vinculo_revisar = true`, para o Arthur
conferir no painel quando quiser.

**Sem risco de vazamento**: pedido não é visível para cliente nenhum (ver
abaixo), então um vínculo errado afeta só a precisão do relatório do admin.

### 🔒 Pedido é exclusivo do painel

Decisão do projeto: **nenhum cliente vê pedido, nem os próprios**. Não existe
"meus pedidos" no catálogo. O cliente fecha o pedido, recebe o e-mail de
confirmação, e daí em diante o assunto corre pelo contato do Arthur.

No banco isso é garantido pela ausência de política de SELECT em `pedidos` e
`pedido_itens`: com RLS ligado, sem política a leitura é negada por padrão.
Mesmo chamando a API direto com o token de um cliente logado, não volta linha.

⚠️ Os itens guardam **texto**, não referência ao produto: o pedido de 2017
precisa continuar legível mesmo que a peça já tenha sido excluída do catálogo.
Onde a referência ainda existir, o vínculo com `produto_id` é criado também.

---

## Pendências antes de importar

1. **Revisar [tamanhos.csv](tamanhos.csv)** — usa a coluna `corrigir_para`.
2. **`tipo_compra` do cliente** — vazio em 95% dos cadastros. Sugestão:
   descartar. Decidir junto com a questão do preço de varejo que o Arthur vai
   conversar com a irmã.
3. **Senhas** — resolvido: 1.820 dos 1.821 clientes ativos têm e-mail válido,
   então o fluxo de "esqueci minha senha" cobre praticamente todos. Falta só
   aprovar o texto do e-mail que avisa os clientes da migração.
4. **Janela de corte** — o sistema está ativo (último pedido em 03/08/2026).
   Combinar com o Arthur a data de virada para não perder pedidos.
5. **Pedido mínimo em R$** — valor ainda não informado.
6. **E-mails de notificação** de pedido novo.

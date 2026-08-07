-- =============================================================================
-- GALÉ COMERCIAL — Catálogo de Atacado
-- Esquema de banco de dados (PostgreSQL / Supabase)
--
-- STATUS: PROPOSTA PARA REVISÃO. Nada foi executado em nenhum banco.
-- Versão 2 — reescrita após mapear o painel antigo (comercialgale.com.br/admin).
--
-- Volume atual do sistema legado:
--   1.825 clientes · 556 produtos · 200 fabricantes
--   6 categorias · 38 subcategorias · 120 tamanhos · 698 pedidos
--
-- Regra de venda descoberta no painel antigo:
--   O produto é vendido em PACOTE FECHADO de N peças (1,2,3,4,5,6,10,12).
--   O cliente escolhe o TAMANHO e quantos PACOTES quer.
--   Cada linha do pedido calcula:
--     valor_pacote = preco_unitario × pecas_por_pacote
--     total_linha  = valor_pacote × qtd_pacotes
--   Todo pedido é totalizado DUAS VEZES: em atacado e em varejo.
-- =============================================================================


-- =============================================================================
-- 1. TIPOS
-- =============================================================================

create type app_role      as enum ('admin', 'cliente');

-- Espelha o status do painel antigo (0=Inativo, 1=Ativo, 2=Incompleto).
-- 'incompleto' = cadastro que o cliente iniciou mas o Arthur ainda não liberou.
create type cliente_status as enum ('inativo', 'ativo', 'incompleto');

create type tipo_pessoa    as enum ('fisica', 'juridica');
create type tipo_compra    as enum ('atacado', 'varejo');

-- Legado usa apenas: 1=AguardandoPag, 2=pago, 3=cancelado.
-- Os demais são a evolução do fluxo real do Arthur (contato → cobrança → envio).
create type pedido_status as enum (
  'novo',
  'em_contato',
  'aguardando_pagamento',   -- legado 1
  'pago',                   -- legado 2
  'em_separacao',
  'enviado',
  'concluido',
  'cancelado'               -- legado 3
);


-- =============================================================================
-- 2. PESSOAS E ACESSO
-- =============================================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null,
  role        app_role not null default 'cliente',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Cadastro comercial. user_id NULLABLE: o Arthur cadastra a empresa antes de
-- liberar o login e pode revogar acesso sem apagar o histórico de pedidos.
create table public.clientes (
  id                bigint primary key generated always as identity,
  user_id           uuid unique references auth.users (id) on delete set null,

  status            cliente_status not null default 'incompleto',
  tipo_pessoa       tipo_pessoa not null,
  tipo_compra       tipo_compra not null default 'atacado',
  cliente_antigo    boolean not null default false,  -- legado: tipo_cadastro NOVO/ANTIGO

  -- Identificação (nome = razão social quando PJ)
  nome              text not null,
  nome_fantasia     text,
  documento         text,               -- CPF ou CNPJ, só dígitos
  rg                text,
  inscricao_estadual text,
  data_nascimento   date,

  -- Contato
  email             text,
  telefone1         text,
  telefone2         text,
  telefone3         text,
  nome_contato      text,

  -- Endereço
  cep               text,
  logradouro        text,
  numero            text,
  complemento       text,
  bairro            text,
  cidade            text,
  uf                char(2),
  pais              text default 'Brasil',

  observacoes       text,               -- anotações internas do Arthur
  pode_ver_precos   boolean not null default true,

  legado_id         bigint,             -- ID do cliente no sistema PHP antigo

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.clientes (status);
create index on public.clientes (nome);
create unique index clientes_legado_id_uniq on public.clientes (legado_id)
  where legado_id is not null;
-- Não usei UNIQUE em documento: no legado há 1.825 cadastros com duplicidade
-- provável. A checagem de duplicados vira uma tela de "revisar cadastros".
create index on public.clientes (documento);


-- =============================================================================
-- 3. CATÁLOGO — TABELAS DE APOIO
-- =============================================================================

-- 200 marcas. No painel antigo o fabricante aparece no nome da foto e é um
-- filtro importante para o lojista ("quero ver tudo da Bruna Lian").
create table public.fabricantes (
  id          bigint primary key generated always as identity,
  nome        text not null,
  slug        text not null unique,
  descricao   text,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  legado_id   bigint unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 6 no legado: Lingerie, Meias, Cuecas, Pijamas, Linha Praia (inativa), Diversos.
create table public.categorias (
  id          bigint primary key generated always as identity,
  nome        text not null,
  slug        text not null unique,
  descricao   text,
  imagem_path text,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  legado_id   bigint unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 38 no legado. Ex: Lingerie > Sutiãs Adultos, Meias > Infantis e Bebês.
create table public.subcategorias (
  id            bigint primary key generated always as identity,
  categoria_id  bigint not null references public.categorias (id) on delete restrict,
  nome          text not null,
  slug          text not null,
  descricao     text,
  ordem         integer not null default 0,
  ativo         boolean not null default true,
  legado_id     bigint unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (categoria_id, slug)
);

create index on public.subcategorias (categoria_id);

-- Tamanhos: catálogo global reutilizado por todos os produtos.
--
-- ATENÇÃO — DÍVIDA DO SISTEMA ANTIGO: os 120 valores da opção "Tamanho" hoje
-- misturam quatro coisas diferentes no mesmo campo:
--   tamanho ......... PP, P, M, G, GG, XG, G1, 34, 36, 38...
--   faixa etária .... "0 a 3 meses", "8a24 m. menina"
--   numeração pé .... "33 a 36", "39 a 42"
--   grade fechada ... "4P/4M/4G", "2P/4M/4G/2GG"
--   COR ............. "TU - Branco", "TU - Azul", "TU - nude+marrom"
-- A coluna `tipo` existe para classificar isso na migração e permitir filtros
-- corretos no catálogo novo. Ver pergunta em aberto no relatório.
create table public.tamanhos (
  id          bigint primary key generated always as identity,
  valor       text not null unique,
  tipo        text not null default 'tamanho'
                check (tipo in ('tamanho','faixa_etaria','numeracao','grade','cor','outro')),
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  legado_id   bigint unique
);

-- Tamanho do pacote fechado. Legado: 1,2,3,4,5,6,10,12 unidades.
create table public.embalagens (
  id            bigint primary key generated always as identity,
  pecas         integer not null unique check (pecas > 0),
  descricao     text not null,          -- "6 unidades"
  ordem         integer not null default 0,
  ativo         boolean not null default true,
  legado_id     bigint unique
);


-- =============================================================================
-- 4. PRODUTOS
-- =============================================================================

create table public.produtos (
  id                bigint primary key generated always as identity,

  categoria_id      bigint not null references public.categorias (id) on delete restrict,
  -- subcategoria é opcional: no legado há produtos soltos direto na categoria.
  subcategoria_id   bigint references public.subcategorias (id) on delete restrict,
  fabricante_id     bigint references public.fabricantes (id) on delete restrict,
  embalagem_id      bigint not null references public.embalagens (id) on delete restrict,

  modelo            text not null,      -- referência da peça. Ex: "MF 307 A"
  titulo            text not null,
  slug              text not null unique,
  descricao         text,
  tags              text[] not null default '{}',   -- legado: campo `tag` separado por vírgula

  -- DOIS preços, ambos por PEÇA (não por pacote):
  --   atacado = o que o lojista paga
  --   varejo  = preço sugerido de revenda, exibido como referência de margem
  preco_atacado     numeric(10,2) not null default 0 check (preco_atacado >= 0),
  preco_varejo      numeric(10,2) not null default 0 check (preco_varejo  >= 0),

  -- Campos fiscais herdados. No legado quase todo produto tem ncm = 0.
  ncm               text,
  possui_st         boolean not null default false,

  ativo             boolean not null default true,
  lancamento        boolean not null default false,   -- legado: IS_LANCAMENTO
  ordem             integer not null default 0,

  legado_id         bigint unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.produtos (categoria_id);
create index on public.produtos (subcategoria_id);
create index on public.produtos (fabricante_id);
create index on public.produtos (ativo);
create index produtos_busca_idx on public.produtos
  using gin (to_tsvector('portuguese',
    titulo || ' ' || modelo || ' ' || coalesce(array_to_string(tags, ' '), '')));

-- Variação = um tamanho disponível do produto, com preço próprio.
-- No painel antigo esta é a tabela "Detalhes Selecionados" do cadastro:
-- colunas NCM | Tamanho | Preço Atacado | Preço Varejo.
-- Preço NULL = herda o preço do produto.
create table public.produto_tamanhos (
  id              bigint primary key generated always as identity,
  produto_id      bigint not null references public.produtos (id) on delete cascade,
  tamanho_id      bigint not null references public.tamanhos (id) on delete restrict,

  preco_atacado   numeric(10,2) check (preco_atacado >= 0),
  preco_varejo    numeric(10,2) check (preco_varejo  >= 0),
  ncm             text,

  ativo           boolean not null default true,
  ordem           integer not null default 0,
  legado_id       bigint unique,

  unique (produto_id, tamanho_id)
);

create index on public.produto_tamanhos (produto_id);

-- Fotos. O legado guarda UMA foto por produto em
--   /arquivos/produto/<slug>.jpg  (+ thumb em /arquivos/produto/thumb/med_<slug>.jpg)
-- O painel novo aceita várias; a migração traz a existente como principal.
create table public.produto_imagens (
  id            bigint primary key generated always as identity,
  produto_id    bigint not null references public.produtos (id) on delete cascade,
  storage_path  text not null,          -- caminho no Supabase Storage
  alt           text,
  ordem         integer not null default 0,
  principal     boolean not null default false,
  legado_url    text,                   -- URL de origem, para reexecutar a migração
  created_at    timestamptz not null default now()
);

create index on public.produto_imagens (produto_id);
create unique index produto_imagens_principal_uniq
  on public.produto_imagens (produto_id) where principal;


-- =============================================================================
-- 5. PEDIDOS
-- =============================================================================

create table public.pedidos (
  id                bigint primary key generated always as identity,
  numero            text not null unique,   -- legado: "2017060000517" (AAAAMM + id)
  cliente_id        bigint not null references public.clientes (id) on delete restrict,

  status            pedido_status not null default 'novo',

  -- O pedido é totalizado nas duas tabelas, como no sistema antigo.
  total_atacado     numeric(12,2) not null default 0,
  total_varejo      numeric(12,2) not null default 0,
  total_pecas       integer not null default 0,
  -- Abatimento que o Arthur concede na negociação por telefone, lançado por ele
  -- depois. Não é desconto de tabela do cliente — não existe tal conceito aqui.
  desconto          numeric(12,2) not null default 0,

  observacoes_cliente text,
  observacoes_admin   text,

  -- Congela o cadastro do cliente na data do pedido. Se ele mudar de endereço
  -- depois, o pedido antigo continua mostrando para onde foi enviado.
  snapshot_cliente  jsonb not null default '{}'::jsonb,

  legado_id         bigint unique,
  criado_em         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.pedidos (cliente_id);
create index on public.pedidos (status);
create index on public.pedidos (criado_em desc);

-- Uma linha por (produto × tamanho), exatamente como no pedido antigo.
create table public.pedido_itens (
  id                bigint primary key generated always as identity,
  pedido_id         bigint not null references public.pedidos (id) on delete cascade,

  produto_id        bigint references public.produtos (id) on delete set null,
  produto_tamanho_id bigint references public.produto_tamanhos (id) on delete set null,

  -- Cópia dos dados no momento da compra: se o Arthur renomear, mudar o preço
  -- ou excluir o produto depois, o pedido histórico continua correto e legível.
  produto_titulo    text not null,
  produto_modelo    text not null,      -- "Ref." no pedido antigo
  tamanho           text,

  pecas_por_pacote  integer not null check (pecas_por_pacote > 0),
  qtd_pacotes       integer not null check (qtd_pacotes > 0),

  preco_atacado     numeric(10,2) not null check (preco_atacado >= 0),  -- por peça
  preco_varejo      numeric(10,2) not null check (preco_varejo  >= 0),  -- por peça

  -- Colunas calculadas: replicam a matemática do pedido antigo e impedem que
  -- um erro de arredondamento no front vire divergência no total.
  total_atacado numeric(12,2) generated always as
    (preco_atacado * pecas_por_pacote * qtd_pacotes) stored,
  total_varejo  numeric(12,2) generated always as
    (preco_varejo  * pecas_por_pacote * qtd_pacotes) stored,
  total_pecas   integer generated always as
    (pecas_por_pacote * qtd_pacotes) stored
);

create index on public.pedido_itens (pedido_id);


-- =============================================================================
-- 6. CONFIGURAÇÕES E AUDITORIA
-- =============================================================================

create table public.configuracoes (
  chave       text primary key,
  valor       jsonb not null,
  descricao   text,
  updated_at  timestamptz not null default now()
);

insert into public.configuracoes (chave, valor, descricao) values
  -- TODO: confirmar o valor real do pedido mínimo com o Arthur.
  ('pedido_minimo_valor', '0',  'Valor mínimo do pedido em R$. 0 = sem mínimo.'),
  ('emails_notificacao',  '[]', 'Quem recebe cópia de cada pedido novo.'),
  ('catalogo_aviso',      '""', 'Aviso exibido no topo do catálogo.'),
  ('exibir_preco_varejo', 'true', 'Mostrar o preço de revenda sugerido ao lojista.');

create table public.log_atividades (
  id          bigint primary key generated always as identity,
  user_id     uuid references auth.users (id) on delete set null,
  acao        text not null,
  entidade    text not null,
  entidade_id text,
  detalhes    jsonb,
  created_at  timestamptz not null default now()
);

create index on public.log_atividades (created_at desc);


-- =============================================================================
-- 7. SEGURANÇA (RLS)
--
-- Regra de ouro: PREÇO SÓ APARECE PARA QUEM TEM LOGIN LIBERADO.
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.clientes         enable row level security;
alter table public.fabricantes      enable row level security;
alter table public.categorias       enable row level security;
alter table public.subcategorias    enable row level security;
alter table public.tamanhos         enable row level security;
alter table public.embalagens       enable row level security;
alter table public.produtos         enable row level security;
alter table public.produto_tamanhos enable row level security;
alter table public.produto_imagens  enable row level security;
alter table public.pedidos          enable row level security;
alter table public.pedido_itens     enable row level security;
alter table public.configuracoes    enable row level security;
alter table public.log_atividades   enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and ativo
  );
$$;

create or replace function public.meu_cliente_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.clientes
  where user_id = auth.uid() and status = 'ativo'
  limit 1;
$$;

create or replace function public.pode_ver_precos()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.clientes
    where user_id = auth.uid() and status = 'ativo' and pode_ver_precos
  );
$$;

-- --- Admin manda em tudo -----------------------------------------------------
create policy "admin total" on public.profiles         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.clientes         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.fabricantes      for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.categorias       for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.subcategorias    for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.tamanhos         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.embalagens       for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.produtos         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.produto_tamanhos for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.produto_imagens  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.pedidos          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.pedido_itens     for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.configuracoes    for all using (public.is_admin()) with check (public.is_admin());
create policy "admin total" on public.log_atividades   for all using (public.is_admin()) with check (public.is_admin());

-- --- Catálogo visível para qualquer visitante (SEM preço) ---------------------
-- A aplicação nunca seleciona as colunas de preço no modo público; a view da
-- seção 8 é a única porta de entrada para valores.
create policy "catalogo publico" on public.fabricantes      for select using (ativo);
create policy "catalogo publico" on public.categorias       for select using (ativo);
create policy "catalogo publico" on public.subcategorias    for select using (ativo);
create policy "catalogo publico" on public.tamanhos         for select using (ativo);
create policy "catalogo publico" on public.embalagens       for select using (ativo);
create policy "catalogo publico" on public.produtos         for select using (ativo);
create policy "catalogo publico" on public.produto_tamanhos for select using (ativo);
create policy "catalogo publico" on public.produto_imagens  for select using (true);

-- --- Cliente logado ----------------------------------------------------------
create policy "cliente ve seu perfil"   on public.profiles for select using (id = auth.uid());
create policy "cliente ve seu cadastro" on public.clientes for select using (user_id = auth.uid());

create policy "cliente ve seus pedidos" on public.pedidos
  for select using (cliente_id = public.meu_cliente_id());
create policy "cliente cria pedido" on public.pedidos
  for insert with check (cliente_id = public.meu_cliente_id());

create policy "cliente ve seus itens" on public.pedido_itens
  for select using (exists (
    select 1 from public.pedidos p
    where p.id = pedido_id and p.cliente_id = public.meu_cliente_id()));
create policy "cliente cria itens" on public.pedido_itens
  for insert with check (exists (
    select 1 from public.pedidos p
    where p.id = pedido_id and p.cliente_id = public.meu_cliente_id()));


-- =============================================================================
-- 8. VIEW DE PREÇOS
--
-- Devolve zero linhas para visitante sem login ou cliente com preço suspenso.
-- Já resolve a herança de preço (tamanho sobrepõe produto) e o valor do pacote.
-- =============================================================================

create or replace view public.precos_visiveis
with (security_invoker = on)
as
select
  p.id                                        as produto_id,
  pt.id                                       as produto_tamanho_id,
  t.valor                                     as tamanho,
  e.pecas                                     as pecas_por_pacote,
  coalesce(pt.preco_atacado, p.preco_atacado) as preco_atacado,
  coalesce(pt.preco_varejo,  p.preco_varejo)  as preco_varejo,
  coalesce(pt.preco_atacado, p.preco_atacado) * e.pecas as valor_pacote_atacado,
  coalesce(pt.preco_varejo,  p.preco_varejo)  * e.pecas as valor_pacote_varejo
from public.produtos p
join public.embalagens e       on e.id = p.embalagem_id
left join public.produto_tamanhos pt on pt.produto_id = p.id and pt.ativo
left join public.tamanhos t          on t.id = pt.tamanho_id
where public.pode_ver_precos();


-- =============================================================================
-- 9. AUTOMAÇÕES
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger t_profiles      before update on public.profiles      for each row execute function public.touch_updated_at();
create trigger t_clientes      before update on public.clientes      for each row execute function public.touch_updated_at();
create trigger t_fabricantes   before update on public.fabricantes   for each row execute function public.touch_updated_at();
create trigger t_categorias    before update on public.categorias    for each row execute function public.touch_updated_at();
create trigger t_subcategorias before update on public.subcategorias for each row execute function public.touch_updated_at();
create trigger t_produtos      before update on public.produtos      for each row execute function public.touch_updated_at();
create trigger t_pedidos       before update on public.pedidos       for each row execute function public.touch_updated_at();

-- Numeração no mesmo formato do sistema antigo: AAAAMM + sequencial de 7 dígitos.
-- Mantém a continuidade visual para o Arthur e para os clientes antigos.
create sequence public.pedido_numero_seq start with 1000;

create or replace function public.gerar_numero_pedido()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    new.numero := to_char(now(), 'YYYYMM')
               || lpad(nextval('public.pedido_numero_seq')::text, 7, '0');
  end if;
  return new;
end $$;

create trigger t_pedido_numero before insert on public.pedidos
  for each row execute function public.gerar_numero_pedido();

-- Recalcula os totais do pedido a partir dos itens.
create or replace function public.recalcular_pedido()
returns trigger language plpgsql as $$
declare pid bigint;
begin
  pid := coalesce(new.pedido_id, old.pedido_id);
  update public.pedidos p set
    total_atacado = coalesce((select sum(i.total_atacado) from public.pedido_itens i where i.pedido_id = pid), 0) - p.desconto,
    total_varejo  = coalesce((select sum(i.total_varejo)  from public.pedido_itens i where i.pedido_id = pid), 0),
    total_pecas   = coalesce((select sum(i.total_pecas)   from public.pedido_itens i where i.pedido_id = pid), 0)
  where p.id = pid;
  return null;
end $$;

create trigger t_recalcular_pedido
  after insert or update or delete on public.pedido_itens
  for each row execute function public.recalcular_pedido();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'cliente')
  );
  return new;
end $$;

create trigger t_novo_usuario after insert on auth.users
  for each row execute function public.handle_new_user();

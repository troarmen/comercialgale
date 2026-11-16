import type { Database, Json } from "@/lib/supabase/tipos";

export type StatusPedido = Database["public"]["Enums"]["pedido_status"];

/**
 * Os status na ordem do processo real do Arthur: chega o pedido, ele fala com
 * o cliente, combina o pagamento, recebe, separa, envia.
 *
 * `cor` usa os tokens do tema, então funciona no claro e no escuro.
 */
export const STATUS: Record<
  StatusPedido,
  { nome: string; cor: string; ponto: string }
> = {
  novo: {
    nome: "Novo",
    cor: "bg-acento-texto/12 text-acento-texto",
    ponto: "bg-acento-texto",
  },
  em_contato: {
    nome: "Em contato",
    cor: "bg-alerta-fundo text-alerta-texto",
    ponto: "bg-alerta-texto",
  },
  aguardando_pagamento: {
    nome: "Aguardando pagamento",
    cor: "bg-alerta-fundo text-alerta-texto",
    ponto: "bg-alerta-texto",
  },
  pago: {
    nome: "Pago",
    cor: "bg-ok-fundo text-ok-texto",
    ponto: "bg-ok-texto",
  },
  em_separacao: {
    nome: "Em separação",
    cor: "bg-tenue/15 text-suave",
    ponto: "bg-tenue",
  },
  enviado: {
    nome: "Enviado",
    cor: "bg-tenue/15 text-suave",
    ponto: "bg-tenue",
  },
  concluido: {
    nome: "Concluído",
    cor: "bg-ok-fundo text-ok-texto",
    ponto: "bg-ok-texto",
  },
  cancelado: {
    nome: "Cancelado",
    cor: "bg-tenue/15 text-tenue",
    ponto: "bg-tenue",
  },
};

export const ORDEM_STATUS: StatusPedido[] = [
  "novo",
  "em_contato",
  "aguardando_pagamento",
  "pago",
  "em_separacao",
  "enviado",
  "concluido",
  "cancelado",
];

const DIA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * dd/mm/aaaa. Aceita os dois tipos que o banco devolve:
 *   • data pura ("2021-04-20", coluna `date`, como `clientes.cadastrado_em`):
 *     não tem fuso, então é só reordenada. Passar por `new Date()` a leria
 *     como meia-noite UTC, que em São Paulo é o dia ANTERIOR — a ficha do
 *     cliente dizia 19/04 e a lista 20/04;
 *   • instante ("2026-11-16T01:30:00+00:00", `timestamptz`): mostrado no dia
 *     de São Paulo. Sem o fuso, o servidor (UTC na Vercel) daria o dia
 *     seguinte para o que aconteceu depois das 21h.
 */
export function dataCurta(iso: string | null) {
  if (!iso) return "—";
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  return DIA_SP.format(new Date(iso));
}

export function dataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CAMPOS_CLIENTE = [
  "nome", "nome_fantasia", "documento", "email", "telefone1", "telefone2",
  "logradouro", "numero", "bairro", "cidade", "uf", "cep",
] as const;

export type ClienteDoPedido = {
  /** id do cadastro — null quando os dados vêm só do snapshot. */
  id: number | null;
  tipo_pessoa: string | null;
} & Record<(typeof CAMPOS_CLIENTE)[number], string | null>;

/**
 * Cliente de um pedido, para exibir no painel.
 *
 * Usa o cadastro (`clientes`) quando o RLS deixa ler — admin — e cai para o
 * `snapshot_cliente` congelado no pedido quando não deixa: o colaborador não
 * tem SELECT em `clientes` (migração 007), e o cadastro pode ter sido apagado.
 * Pedidos do sistema antigo têm só o nome no snapshot; os novos têm tudo.
 */
export function clienteDoPedido(
  cadastro: (Partial<Omit<ClienteDoPedido, "id">> & { id: number }) | null,
  snapshot: Json,
): ClienteDoPedido | null {
  const s: { [chave: string]: Json | undefined } =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot
      : {};
  const texto = (v: Json | undefined) =>
    typeof v === "string" && v.trim() ? v : null;

  const base: Partial<ClienteDoPedido> = cadastro ?? {};
  const cliente = { id: cadastro?.id ?? null } as ClienteDoPedido;
  for (const campo of CAMPOS_CLIENTE) {
    cliente[campo] = base[campo] ?? texto(s[campo]);
  }
  if (!cliente.nome) return null;

  // O snapshot do catálogo não guarda o tipo de pessoa; o documento entrega
  // (CNPJ tem 14 dígitos, CPF 11).
  const digitos = cliente.documento?.replace(/\D/g, "").length ?? 0;
  cliente.tipo_pessoa =
    base.tipo_pessoa ??
    texto(s.tipo_pessoa) ??
    (digitos === 14 ? "juridica" : digitos === 11 ? "fisica" : null);
  return cliente;
}

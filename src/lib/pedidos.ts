import type { Database } from "@/lib/supabase/tipos";

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

export function dataCurta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
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

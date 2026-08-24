"use client";

import { useSyncExternalStore } from "react";

/**
 * Carrinho do catálogo — estado local do navegador.
 *
 * O carrinho não vive no banco: o pedido só existe quando o cliente fecha.
 * Nenhum preço é guardado aqui — valor é sempre reconsultado no servidor pela
 * view `precos_visiveis`, para o total nunca depender do que o navegador diz.
 *
 * A chave de um item é o `produto_tamanho_id` (estável: o painel atualiza a
 * grade no lugar, sem recriar linhas). Produto sem grade usa só o produto_id.
 *
 * Mesmo desenho do tema (alternar-tema): o estado mora FORA do React, num
 * armazém que o `useSyncExternalStore` observa — sem efeito, sem provider e
 * sem "piscar" de hidratação: o servidor enxerga `pronto: false` e o número
 * do carrinho só aparece depois de ler o localStorage.
 */

export type ItemCarrinho = {
  produtoId: number;
  produtoTamanhoId: number | null;
  slug: string;
  titulo: string;
  modelo: string;
  tamanho: string | null;
  pecasNoKit: number;
  foto: string | null;
  qtdKits: number;
};

type Estado = { itens: ItemCarrinho[]; pronto: boolean };

const ARMAZENAMENTO = "gale:carrinho";
const ESTADO_SERVIDOR: Estado = { itens: [], pronto: false };

let estado: Estado = ESTADO_SERVIDOR;
let inicializado = false;
const ouvintes = new Set<() => void>();

export function chaveItem(i: {
  produtoId: number;
  produtoTamanhoId: number | null;
}) {
  return `${i.produtoId}:${i.produtoTamanhoId ?? "unico"}`;
}

function lerArmazenamento(): ItemCarrinho[] {
  try {
    const bruto = localStorage.getItem(ARMAZENAMENTO);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function emitir() {
  for (const avisar of ouvintes) avisar();
}

function gravar(itens: ItemCarrinho[]) {
  estado = { itens, pronto: true };
  try {
    localStorage.setItem(ARMAZENAMENTO, JSON.stringify(itens));
  } catch {
    // armazenamento cheio ou bloqueado: o carrinho vale só nesta aba
  }
  emitir();
}

function subscrever(avisar: () => void) {
  ouvintes.add(avisar);
  if (!inicializado) {
    inicializado = true;
    estado = { itens: lerArmazenamento(), pronto: true };
    avisar();
    // outra aba mexeu no carrinho? Esta acompanha.
    window.addEventListener("storage", aoMudarEmOutraAba);
  }
  return () => {
    ouvintes.delete(avisar);
  };
}

function aoMudarEmOutraAba(e: StorageEvent) {
  if (e.key !== ARMAZENAMENTO) return;
  estado = { itens: lerArmazenamento(), pronto: true };
  emitir();
}

const lerEstado = () => estado;
const lerEstadoServidor = () => ESTADO_SERVIDOR;

// ------------------------------------------------------------------- ações

export function adicionarAoCarrinho(
  item: Omit<ItemCarrinho, "qtdKits">,
  qtdKits: number,
) {
  const chave = chaveItem(item);
  const existente = estado.itens.find((i) => chaveItem(i) === chave);
  gravar(
    existente
      ? estado.itens.map((i) =>
          chaveItem(i) === chave
            ? { ...i, qtdKits: Math.min(999, i.qtdKits + qtdKits) }
            : i,
        )
      : [...estado.itens, { ...item, qtdKits: Math.min(999, qtdKits) }],
  );
}

export function alterarQtdDoCarrinho(chave: string, qtdKits: number) {
  gravar(
    qtdKits <= 0
      ? estado.itens.filter((i) => chaveItem(i) !== chave)
      : estado.itens.map((i) =>
          chaveItem(i) === chave ? { ...i, qtdKits: Math.min(999, qtdKits) } : i,
        ),
  );
}

export function removerDoCarrinho(chave: string) {
  gravar(estado.itens.filter((i) => chaveItem(i) !== chave));
}

export function limparCarrinho() {
  gravar([]);
}

/** Estado reativo do carrinho para qualquer componente cliente. */
export function useCarrinho() {
  return useSyncExternalStore(subscrever, lerEstado, lerEstadoServidor);
}

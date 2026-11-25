"use client";

import { useState, useTransition } from "react";
import { excluirProduto } from "./acoes";

export function ExcluirProduto({
  id,
  emPedidos,
}: {
  id: number;
  emPedidos: number;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pendente}
        title="Excluir produto"
        onClick={() => {
          const aviso = emPedidos
            ? `Excluir este produto e suas fotos? Não dá para desfazer.\n\n` +
              `Ele aparece em ${emPedidos} ${emPedidos === 1 ? "pedido" : "pedidos"}: ` +
              `os pedidos continuam com nome, referência e preços, só perdem o link para a ficha.\n\n` +
              `Se o produto pode voltar a ser vendido, desative em vez de excluir.`
            : "Excluir este produto e suas fotos? Não dá para desfazer.";
          if (!confirm(aviso)) return;
          iniciar(async () => {
            const r = await excluirProduto(id);
            setErro(r?.erro ?? null);
          });
        }}
        className="h-9 rounded-lg px-3.5 text-sm text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-suave"
      >
        {pendente ? "Excluindo…" : "Excluir"}
      </button>
      {erro && <p className="mt-1 max-w-xs text-xs text-acento-texto">{erro}</p>}
    </div>
  );
}

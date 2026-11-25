"use client";

import { useState, useTransition } from "react";
import { enviarLoteConvites, type ResultadoLote } from "./acoes";

export function EnviarLote({ tamanho, naFila }: { tamanho: number; naFila: number }) {
  const [pendente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);
  const quantos = Math.min(tamanho, naFila);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pendente || naFila === 0}
        onClick={() => {
          if (
            !confirm(
              `Enviar o convite "crie a sua senha no site novo" para ${quantos} ${
                quantos === 1 ? "cliente" : "clientes"
              }?`,
            )
          )
            return;
          iniciar(async () => setResultado(await enviarLoteConvites()));
        }}
        className="flex h-9 items-center rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendente
          ? "Enviando… (pode levar até 1 minuto)"
          : naFila === 0
            ? "Nada a enviar agora"
            : `Enviar convite para os próximos ${quantos}`}
      </button>
      {resultado && "erro" in resultado && (
        <p className="text-sm text-acento-texto">{resultado.erro}</p>
      )}
      {resultado && !("erro" in resultado) && (
        <p className="text-sm text-suave" role="status">
          {resultado.enviados} {resultado.enviados === 1 ? "convite enviado" : "convites enviados"}
          {resultado.falharam > 0 && ` · ${resultado.falharam} não saíram (veja a ficha de cada um)`}
          {resultado.restantes > 0
            ? ` · faltam ${resultado.restantes}.`
            : " · todos da fila receberam."}
        </p>
      )}
    </div>
  );
}

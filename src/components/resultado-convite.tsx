"use client";

import { useState } from "react";

/**
 * Resultado de "criar login" / "reenviar link" no painel.
 *
 * E-mail saiu: só confirma. Não saiu: mostra o link para o Arthur copiar e
 * mandar por WhatsApp — o link vale 1 hora e funciona uma vez.
 */
export function ResultadoConvite({
  titulo,
  email,
  emailEnviado,
  link,
  aoFechar,
}: {
  titulo: string;
  email: string;
  emailEnviado: boolean;
  link?: string;
  aoFechar?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  if (emailEnviado) {
    return (
      <div role="status" className="rounded-xl border border-ok-texto/30 bg-ok-fundo p-4">
        <p className="text-sm font-semibold text-ok-texto">{titulo}</p>
        <p className="mt-1 text-sm text-ok-texto">
          Enviamos para <strong className="break-all font-semibold">{email}</strong> o
          link para criar a senha. O link vale por 1 hora; se expirar, a pessoa usa
          &quot;Esqueci minha senha&quot; no login.
        </p>
        {aoFechar && (
          <button
            type="button"
            onClick={aoFechar}
            className="mt-3 h-9 rounded-lg px-3.5 text-sm text-ok-texto transition hover:bg-ok-texto/10"
          >
            Ok
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-xl border border-alerta-texto/30 bg-alerta-fundo p-4">
      <p className="text-sm font-semibold text-alerta-texto">{titulo}, mas o e-mail não saiu</p>
      {link ? (
        <>
          <p className="mt-1 text-sm text-alerta-texto">
            Copie o link abaixo e mande para {email} por WhatsApp. Ele vale por 1
            hora e funciona uma vez só.
          </p>
          <p className="mt-3 select-all break-all rounded-lg bg-superficie p-3 font-mono text-xs text-texto">
            {link}
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(link).then(() => setCopiado(true));
            }}
            className="mt-3 h-9 rounded-lg border border-alerta-texto/40 px-3.5 text-sm font-medium text-alerta-texto transition hover:bg-alerta-texto/10"
          >
            {copiado ? "Copiado" : "Copiar link"}
          </button>
        </>
      ) : (
        <p className="mt-1 text-sm text-alerta-texto">
          O login foi criado. Tente mandar o link de novo daqui a pouco pelo botão de
          reenviar, ou peça para a pessoa usar &quot;Esqueci minha senha&quot; no login.
        </p>
      )}
      {aoFechar && (
        <button
          type="button"
          onClick={aoFechar}
          className="mt-3 ml-2 h-9 rounded-lg px-3.5 text-sm text-alerta-texto transition hover:bg-alerta-texto/10"
        >
          Fechar
        </button>
      )}
    </div>
  );
}

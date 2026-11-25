"use client";

import { useState, useTransition } from "react";
import { testarEmail } from "./acoes";

/**
 * Botão "Enviar e-mail de teste" — pedido do cliente de 24/11 (item 5.4):
 * conferir se os e-mails automáticos estão saindo. O teste vai para o e-mail
 * do login de quem clicou.
 */
export function TesteEmail({ configurado }: { configurado: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  return (
    <section className="mt-5 max-w-3xl rounded-xl border border-borda bg-superficie p-5">
      <h2 className="text-sm font-semibold text-texto">E-mails automáticos</h2>
      <p className="mt-1 text-sm leading-relaxed text-suave">
        {configurado
          ? "O site envia a confirmação de pedido, as boas-vindas de cadastro e os links de senha. Cada envio fica registrado na ficha do pedido e na do cliente. Para conferir agora, mande um teste para o seu e-mail."
          : "O envio de e-mails não está configurado neste ambiente: nenhum e-mail automático sai."}
      </p>
      {configurado && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await testarEmail();
                setMsg(
                  "ok" in r
                    ? { ok: true, texto: `Enviado para ${r.para}. Confira a caixa de entrada (e o spam).` }
                    : { ok: false, texto: r.erro },
                );
              })
            }
            className="h-9 rounded-lg border border-borda-forte px-3.5 text-sm font-medium text-texto transition hover:bg-superficie-2 disabled:opacity-50"
          >
            {pendente ? "Enviando…" : "Enviar e-mail de teste"}
          </button>
          {msg && (
            <p role="status" className={`text-sm ${msg.ok ? "text-ok-texto" : "text-acento-texto"}`}>
              {msg.texto}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

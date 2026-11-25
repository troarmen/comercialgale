/**
 * Quadro "E-mails" da ficha do pedido e da ficha do cliente: cada e-mail que o
 * site disparou e o que aconteceu (registros `email_enviado` / `email_falhou`
 * de `log_atividades`, gravados por src/lib/email.ts desde 25/11/2026).
 *
 * "Enviado" = o servidor de e-mail (Brevo) aceitou a mensagem. Se depois ela
 * foi para o spam ou voltou, só o painel do Brevo mostra (Transacional → Logs).
 */

export type LinhaEmail = {
  id: number;
  acao: string;
  created_at: string;
  detalhes: unknown;
};

const HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function campo(d: unknown, chave: string) {
  if (!d || typeof d !== "object") return null;
  const v = (d as Record<string, unknown>)[chave];
  return typeof v === "string" && v ? v : null;
}

export function RegistroEmails({ linhas, vazio }: { linhas: LinhaEmail[]; vazio: string }) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-4">
      <h2 className="mb-2 text-sm font-semibold text-texto">E-mails</h2>
      {linhas.length === 0 ? (
        <p className="text-sm leading-relaxed text-suave">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {linhas.map((l) => {
            const ok = l.acao === "email_enviado";
            const erro = campo(l.detalhes, "erro");
            return (
              <li key={l.id} className="text-sm leading-snug">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-texto">
                    {campo(l.detalhes, "tipo") ?? "e-mail"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      ok ? "bg-ok-fundo text-ok-texto" : "bg-alerta-fundo text-alerta-texto"
                    }`}
                  >
                    {ok ? "enviado" : "não saiu"}
                  </span>
                </div>
                <p className="break-all text-xs text-suave">
                  {campo(l.detalhes, "para") ?? "—"} · {HORA.format(new Date(l.created_at))}
                </p>
                {!ok && erro && <p className="mt-0.5 text-xs text-alerta-texto">{erro}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

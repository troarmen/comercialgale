import type { Metadata } from "next";
import Link from "next/link";
import { BotaoVoltar } from "@/components/voltar";
import { smtpConfigurado } from "@/lib/email";
import { numero } from "@/lib/formato";
import { exigirAdminPagina } from "@/lib/sessao";
import { filaDeConvite, pendentesDeSenha, TAMANHO_LOTE } from "./dados";
import { EnviarLote } from "./enviar";

export const metadata: Metadata = { title: "Criar senha · Galé Comercial" };

// o lote de convites roda nesta página e manda até 25 e-mails, um por um
export const maxDuration = 60;

const DIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Clientes do site antigo que ainda não criaram a senha no site novo, com o
 * envio do convite em lotes (relatório do cliente de 24/11, item 5.3).
 */
export default async function PaginaSenhasPendentes() {
  await exigirAdminPagina();
  const pendentes = await pendentesDeSenha();
  const naFila = filaDeConvite(pendentes).length;
  const convidados = pendentes.filter((p) => p.ultimoConvite).length;

  return (
    <div className="px-8 py-7">
      <div className="mb-3">
        <BotaoVoltar chave="clientes" padrao="/admin/clientes" rotulo="Voltar para clientes" />
      </div>

      <header className="mb-5 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Clientes que ainda não criaram a senha
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          São os clientes ativos que vieram do site antigo com login e ainda
          não entraram no site novo (quem cria a senha pelo link já entra na
          hora, e sai desta lista). O convite explica que o site mudou e traz
          o link para criar a senha; o login é o próprio e-mail.
        </p>
      </header>

      <div className="mb-5 grid max-w-3xl gap-4 rounded-xl border border-borda bg-superficie p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="text-sm leading-relaxed text-suave">
          <p>
            <strong className="text-texto">{numero(pendentes.length)}</strong>{" "}
            {pendentes.length === 1 ? "cliente sem senha" : "clientes sem senha"} ·{" "}
            {numero(convidados)} já {convidados === 1 ? "convidado" : "convidados"} ·{" "}
            <strong className="text-texto">{numero(naFila)}</strong> na fila do próximo envio
          </p>
          <p className="mt-1 text-xs text-tenue">
            Vai em lotes de {TAMANHO_LOTE}: o serviço de e-mail tem cota diária
            (cerca de 300 por dia, somando pedidos e cadastros). Quem recebeu
            convite nos últimos 7 dias espera o lote seguinte. O link vale 24
            horas; depois disso a pessoa usa &quot;Esqueci minha senha&quot; no
            site com o mesmo e-mail.
          </p>
        </div>
        {smtpConfigurado() ? (
          <EnviarLote tamanho={TAMANHO_LOTE} naFila={naFila} />
        ) : (
          <p className="text-sm text-alerta-texto">E-mail não configurado neste ambiente.</p>
        )}
      </div>

      {pendentes.length > 0 && (
        <div className="max-w-5xl overflow-hidden rounded-xl border border-borda bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">E-mail do login</th>
                <th className="px-4 py-3 font-medium">Cidade</th>
                <th className="px-4 py-3 font-medium">Último convite</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((p) => (
                <tr key={p.id} className="border-b border-borda last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/clientes/${p.id}`}
                      className="font-medium text-texto hover:text-acento-texto"
                    >
                      {p.nomeFantasia || p.nome}
                    </Link>
                  </td>
                  <td className="break-all px-4 py-2.5 text-suave">{p.email}</td>
                  <td className="px-4 py-2.5 text-suave">
                    {[p.cidade, p.uf].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-suave">
                    {p.ultimoConvite ? DIA.format(new Date(p.ultimoConvite)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

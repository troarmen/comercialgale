"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/cadastro-ui";
import { ResultadoConvite } from "@/components/resultado-convite";
import { criarAcesso, reenviarSenha, revogarAcesso } from "./acoes";

/**
 * Login do cliente no catálogo.
 *
 * Desde nov/2026 quem se cadastra pelo SITE já nasce com login e senha
 * escolhida por ele (cadastro/acoes.ts) — o botão "Criar login e enviar
 * convite" ficou para os clientes cadastrados pela equipe e para os antigos
 * que ainda não têm login.
 */
export function GerenciarAcesso({
  clienteId,
  temLogin,
  email,
  podeVerPrecos,
  status,
}: {
  clienteId: number;
  temLogin: boolean;
  email: string | null;
  podeVerPrecos: boolean;
  /** situação da ficha — opcional para não quebrar quem ainda não passa */
  status?: "ativo" | "inativo" | "incompleto";
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [convite, setConvite] = useState<{
    titulo: string;
    emailEnviado: boolean;
    link?: string;
  } | null>(null);
  const [emailNovo, setEmailNovo] = useState(email ?? "");
  // Com login, o endereço para onde o link foi volta da action (é o do
  // login, que numa ficha "a@x; b@y" pode ser qualquer um dos dois).
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  if (convite) {
    return (
      <ResultadoConvite
        titulo={convite.titulo}
        email={(temLogin ? enviadoPara : emailNovo) ?? ""}
        emailEnviado={convite.emailEnviado}
        link={convite.link}
        aoFechar={() => setConvite(null)}
      />
    );
  }

  if (!temLogin) {
    return (
      <div className="rounded-xl border border-borda bg-superficie p-4">
        <h2 className="text-sm font-semibold text-texto">Acesso ao catálogo</h2>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          Este cliente ainda não tem login, então navega no catálogo{" "}
          <strong className="font-medium text-texto">sem ver preço</strong>.
          Criar o login libera os valores: ele recebe por e-mail o link para
          criar a própria senha.
        </p>
        <p className="mt-2 mb-3 text-xs leading-relaxed text-suave">
          Cadastros feitos pelo site já chegam com login — o próprio lojista
          cria a senha ao se cadastrar. Use este botão só para clientes
          cadastrados pela equipe ou antigos que ainda não têm login.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto">E-mail de acesso</span>
          <input
            type="email"
            value={emailNovo}
            onChange={(e) => setEmailNovo(e.target.value)}
            placeholder="cliente@exemplo.com"
            className="h-10 rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500"
          />
        </label>

        {erro && (
          <div className="mt-3">
            <Aviso mensagem={erro} />
          </div>
        )}

        <button
          type="button"
          disabled={pendente || !emailNovo}
          onClick={() =>
            iniciar(async () => {
              const r = await criarAcesso(clienteId, emailNovo);
              setErro(r.erro ?? null);
              if (r.ok) {
                setConvite({
                  titulo: "Login criado",
                  emailEnviado: r.emailEnviado ?? false,
                  link: r.link,
                });
              }
            })
          }
          className="mt-3 h-10 w-full rounded-lg bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-50"
        >
          {pendente ? "Criando…" : "Criar login e enviar convite"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <h2 className="text-sm font-semibold text-texto">Acesso ao catálogo</h2>
      <p className="mt-1 text-sm text-suave">
        Entra com <span className="break-all text-texto">{email}</span>
      </p>
      <p className="mt-2 text-sm text-suave">
        {status && status !== "ativo" ? (
          <span className="text-alerta-texto">
            {status === "incompleto"
              ? "Login criado, aguardando liberação: o cliente só vê preço quando a situação mudar para Ativo (ele recebe um e-mail avisando)."
              : "Login existe, mas a ficha está Inativa: o cliente não vê preço."}
          </span>
        ) : podeVerPrecos ? (
          <span className="text-ok-texto">Enxerga os preços normalmente.</span>
        ) : (
          <span className="text-alerta-texto">
            Login ativo, mas a visualização de preço está suspensa (mude no
            formulário ao lado).
          </span>
        )}
      </p>

      {erro && (
        <div className="mt-3">
          <Aviso mensagem={erro} />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await reenviarSenha(clienteId);
              setErro(r.erro ?? null);
              if (r.ok) {
                setEnviadoPara(r.para ?? null);
                setConvite({
                  titulo: "Link enviado",
                  emailEnviado: r.emailEnviado ?? false,
                  link: r.link,
                });
              }
            })
          }
          className="h-9 rounded-lg border border-borda px-3.5 text-sm font-medium text-texto transition hover:bg-superficie-2 disabled:opacity-50"
        >
          Enviar link para criar nova senha
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            if (
              !confirm(
                "Revogar o acesso deste cliente?\n\nO cadastro e todos os pedidos continuam salvos — só o login é removido. Ele volta a navegar sem ver preço e não consegue se liberar sozinho pelo cadastro do site. Para devolver o acesso, use \"Criar login e enviar convite\" aqui na ficha.",
              )
            )
              return;
            iniciar(async () => {
              const r = await revogarAcesso(clienteId);
              setErro(r.erro ?? null);
            });
          }}
          className="h-9 rounded-lg px-3.5 text-sm text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto disabled:opacity-50"
        >
          Revogar acesso
        </button>
      </div>
    </div>
  );
}

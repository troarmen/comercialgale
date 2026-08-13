"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/cadastro-ui";
import { criarAcesso, reenviarSenha, revogarAcesso } from "./acoes";

export function GerenciarAcesso({
  clienteId,
  temLogin,
  email,
  podeVerPrecos,
}: {
  clienteId: number;
  temLogin: boolean;
  email: string | null;
  podeVerPrecos: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [emailNovo, setEmailNovo] = useState(email ?? "");

  if (senha) {
    return (
      <div className="rounded-xl border border-ok-texto/30 bg-ok-fundo p-4">
        <p className="text-sm font-semibold text-ok-texto">Login criado</p>
        <p className="mt-1 text-sm text-ok-texto/90">
          Passe estes dados ao cliente. A senha aparece uma vez só.
        </p>
        <dl className="mt-3 space-y-1.5 rounded-lg bg-superficie p-3 text-sm">
          <div className="flex gap-2">
            <dt className="text-tenue">E-mail:</dt>
            <dd className="break-all font-medium text-texto">{emailNovo}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-tenue">Senha:</dt>
            <dd className="select-all font-mono font-medium text-texto">
              {senha}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`E-mail: ${emailNovo}\nSenha: ${senha}`);
          }}
          className="mt-3 h-9 rounded-lg border border-ok-texto/40 px-3.5 text-sm font-medium text-ok-texto transition hover:bg-ok-texto/10"
        >
          Copiar
        </button>
      </div>
    );
  }

  if (!temLogin) {
    return (
      <div className="rounded-xl border border-borda bg-superficie p-4">
        <h2 className="text-sm font-semibold text-texto">Acesso ao catálogo</h2>
        <p className="mt-1 mb-3 text-sm leading-relaxed text-suave">
          Este cliente ainda não tem login, então navega no catálogo{" "}
          <strong className="font-medium text-texto">sem ver preço</strong>.
          Criar o login libera os valores para ele.
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
              if (r.senha) setSenha(r.senha);
            })
          }
          className="mt-3 h-10 w-full rounded-lg bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-50"
        >
          {pendente ? "Criando…" : "Criar login e liberar preços"}
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
        {podeVerPrecos ? (
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
      {enviado && (
        <p className="mt-3 text-sm text-ok-texto">
          E-mail de redefinição enviado.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          disabled={pendente || !email}
          onClick={() =>
            iniciar(async () => {
              const r = await reenviarSenha(email!);
              setErro(r.erro ?? null);
              setEnviado(!r.erro);
            })
          }
          className="h-9 rounded-lg border border-borda px-3.5 text-sm font-medium text-texto transition hover:bg-superficie-2 disabled:opacity-50"
        >
          Enviar e-mail para redefinir senha
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            if (
              !confirm(
                "Revogar o acesso deste cliente?\n\nO cadastro e todos os pedidos continuam salvos — só o login é removido. Ele volta a navegar sem ver preço.",
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

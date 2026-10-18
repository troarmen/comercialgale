"use client";

import { useState, useTransition } from "react";
import { Aviso, CAMPO } from "@/components/cadastro-ui";
import { ResultadoConvite } from "@/components/resultado-convite";
import { alternarColaborador, criarColaborador, removerColaborador } from "./acoes";

export function NovoColaborador() {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{
    email: string;
    emailEnviado: boolean;
    link?: string;
  } | null>(null);

  if (criado) {
    return (
      <ResultadoConvite
        titulo="Colaborador criado"
        email={criado.email}
        emailEnviado={criado.emailEnviado}
        link={criado.link}
        aoFechar={() => {
          setCriado(null);
          setNome("");
          setEmail("");
        }}
      />
    );
  }

  return (
    <form
      className="rounded-xl border border-borda bg-superficie p-4"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await criarColaborador(nome, email);
          setErro(r.erro ?? null);
          if (r.ok) {
            setCriado({
              email: email.trim().toLowerCase(),
              emailEnviado: r.emailEnviado ?? false,
              link: r.link,
            });
          }
        });
      }}
    >
      <h2 className="text-sm font-semibold text-texto">Novo colaborador</h2>
      <p className="mt-1 mb-3 text-sm leading-relaxed text-suave">
        VÃª a lista e a ficha dos pedidos, com os dados de envio do cliente, e{" "}
        <strong className="font-medium text-texto">
          sÃ³ pode mudar a situaÃ§Ã£o do pedido
        </strong>
        . NÃ£o acessa clientes, produtos nem configuraÃ§Ãµes.
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={CAMPO}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-texto">E-mail de acesso</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@comercialgale.com.br"
            className={CAMPO}
            autoComplete="off"
          />
        </label>
      </div>
      {erro && (
        <div className="mt-3">
          <Aviso mensagem={erro} />
        </div>
      )}
      <button
        type="submit"
        disabled={pendente || !nome.trim() || !email.trim()}
        className="mt-3 h-10 w-full rounded-lg bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-50"
      >
        {pendente ? "Criandoâ€¦" : "Criar login e enviar convite"}
      </button>
    </form>
  );
}

export function AcoesColaborador({
  id,
  nome,
  ativo,
}: {
  id: string;
  nome: string;
  ativo: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await alternarColaborador(id, !ativo);
              setErro(r.erro ?? null);
            })
          }
          className="h-8 rounded-lg border border-borda px-3 text-xs font-medium text-texto transition hover:bg-superficie-2 disabled:opacity-50"
        >
          {ativo ? "Desativar" : "Reativar"}
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => {
            if (
              !confirm(
                `Remover o login de ${nome}?\n\nEle perde o acesso de vez. Para sÃ³ suspender, use "Desativar".`,
              )
            )
              return;
            iniciar(async () => {
              const r = await removerColaborador(id);
              setErro(r.erro ?? null);
            });
          }}
          className="h-8 rounded-lg px-3 text-xs text-suave transition hover:bg-acento-texto/10 hover:text-acento-texto disabled:opacity-50"
        >
          Remover
        </button>
      </div>
      {erro && <p className="text-xs text-acento-texto">{erro}</p>}
    </div>
  );
}

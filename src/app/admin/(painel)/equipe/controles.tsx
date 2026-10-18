"use client";

import { useState, useTransition } from "react";
import { Aviso, CAMPO } from "@/components/cadastro-ui";
import { alternarColaborador, criarColaborador, removerColaborador } from "./acoes";

export function NovoColaborador() {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null);

  if (criado) {
    return (
      <div className="rounded-xl border border-ok-texto/30 bg-ok-fundo p-4">
        <p className="text-sm font-semibold text-ok-texto">Colaborador criado</p>
        <p className="mt-1 text-sm text-ok-texto">
          Passe estes dados a ele. A senha aparece uma vez só. O acesso é pelo
          mesmo endereço do painel e mostra apenas os pedidos.
        </p>
        <dl className="mt-3 space-y-1.5 rounded-lg bg-superficie p-3 text-sm">
          <div className="flex gap-2">
            <dt className="text-tenue">E-mail:</dt>
            <dd className="break-all font-medium text-texto">{criado.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-tenue">Senha:</dt>
            <dd className="select-all font-mono font-medium text-texto">{criado.senha}</dd>
          </div>
        </dl>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(
                `Painel: ${location.origin}/admin\nE-mail: ${criado.email}\nSenha: ${criado.senha}`,
              );
            }}
            className="h-9 rounded-lg border border-ok-texto/40 px-3.5 text-sm font-medium text-ok-texto transition hover:bg-ok-texto/10"
          >
            Copiar
          </button>
          <button
            type="button"
            onClick={() => {
              setCriado(null);
              setNome("");
              setEmail("");
            }}
            className="h-9 rounded-lg px-3.5 text-sm text-ok-texto transition hover:bg-ok-texto/10"
          >
            Cadastrar outro
          </button>
        </div>
      </div>
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
          if (r.senha) setCriado({ email: email.trim().toLowerCase(), senha: r.senha });
        });
      }}
    >
      <h2 className="text-sm font-semibold text-texto">Novo colaborador</h2>
      <p className="mt-1 mb-3 text-sm leading-relaxed text-suave">
        Vê a lista e a ficha dos pedidos, com os dados de envio do cliente, e{" "}
        <strong className="font-medium text-texto">
          só pode mudar a situação do pedido
        </strong>
        . Não acessa clientes, produtos nem configurações.
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
        {pendente ? "Criando…" : "Criar login"}
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
                `Remover o login de ${nome}?\n\nEle perde o acesso de vez. Para só suspender, use "Desativar".`,
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

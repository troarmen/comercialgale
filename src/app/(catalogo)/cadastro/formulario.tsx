"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { linkWhatsApp } from "@/lib/contato";
import { solicitarCadastro, type EstadoCadastro } from "./acoes";

const CLASSE_CAMPO =
  "h-11 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";
const CLASSE_ROTULO = "mb-1.5 block text-sm font-medium text-texto";

export function FormularioCadastro() {
  const [estado, enviar, enviando] = useActionState<EstadoCadastro, FormData>(
    solicitarCadastro,
    { ok: false },
  );
  const [tipoPessoa, setTipoPessoa] = useState<"juridica" | "fisica">("juridica");

  if (estado.ok) {
    return (
      <div className="rounded-2xl border border-borda/60 bg-superficie p-8 text-center shadow-suave">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-fundo">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-ok-texto" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-texto">
          Cadastro enviado!
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-suave">
          Nossa equipe confere os dados e libera o seu acesso de lojista. Você
          recebe o login por e-mail — e enquanto isso já pode navegar por todo o
          catálogo.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/produtos"
            className="flex h-11 items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
          >
            Ver o catálogo
          </Link>
          <a
            href={linkWhatsApp("Olá! Acabei de enviar meu cadastro pelo site e quero agilizar a liberação.")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-acento-texto transition hover:text-acento-forte"
          >
            Agilizar pelo WhatsApp →
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={enviar} className="rounded-2xl border border-borda/60 bg-superficie p-6 shadow-suave sm:p-8">
      {/* Honeypot anti-robô: fica fora da tela e fora da ordem de tabulação */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Não preencha este campo
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className={CLASSE_ROTULO}>Sua loja compra como</legend>
        <div className="flex gap-2" role="radiogroup">
          {(
            [
              ["juridica", "Pessoa jurídica (CNPJ)"],
              ["fisica", "Pessoa física (CPF)"],
            ] as const
          ).map(([valor, rotulo]) => (
            <label
              key={valor}
              className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium transition ${
                tipoPessoa === valor
                  ? "border-acento bg-acento-texto/8 text-acento-texto"
                  : "border-borda text-suave hover:border-borda-forte"
              }`}
            >
              <input
                type="radio"
                name="tipo_pessoa"
                value={valor}
                checked={tipoPessoa === valor}
                onChange={() => setTipoPessoa(valor)}
                className="sr-only"
              />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nome" className={CLASSE_ROTULO}>
            {tipoPessoa === "juridica" ? "Razão social" : "Nome completo"} *
          </label>
          <input id="nome" name="nome" required maxLength={200} className={CLASSE_CAMPO} />
        </div>

        <div>
          <label htmlFor="nome_fantasia" className={CLASSE_ROTULO}>
            Nome da loja
          </label>
          <input id="nome_fantasia" name="nome_fantasia" maxLength={200} className={CLASSE_CAMPO} />
        </div>

        <div>
          <label htmlFor="documento" className={CLASSE_ROTULO}>
            {tipoPessoa === "juridica" ? "CNPJ" : "CPF"} *
          </label>
          <input
            id="documento"
            name="documento"
            required
            inputMode="numeric"
            placeholder={tipoPessoa === "juridica" ? "00.000.000/0000-00" : "000.000.000-00"}
            className={CLASSE_CAMPO}
          />
        </div>

        {tipoPessoa === "juridica" && (
          <div>
            <label htmlFor="inscricao_estadual" className={CLASSE_ROTULO}>
              Inscrição estadual
            </label>
            <input id="inscricao_estadual" name="inscricao_estadual" maxLength={30} className={CLASSE_CAMPO} />
          </div>
        )}

        <div>
          <label htmlFor="nome_contato" className={CLASSE_ROTULO}>
            Quem cuida das compras
          </label>
          <input id="nome_contato" name="nome_contato" maxLength={120} className={CLASSE_CAMPO} />
        </div>

        <div>
          <label htmlFor="email" className={CLASSE_ROTULO}>
            E-mail *
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={CLASSE_CAMPO} />
        </div>

        <div>
          <label htmlFor="telefone" className={CLASSE_ROTULO}>
            Telefone / WhatsApp *
          </label>
          <input
            id="telefone"
            name="telefone"
            required
            inputMode="tel"
            placeholder="(11) 90000-0000"
            autoComplete="tel"
            className={CLASSE_CAMPO}
          />
        </div>
      </div>

      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wider text-tenue">
        Endereço da loja
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label htmlFor="cep" className={CLASSE_ROTULO}>
            CEP
          </label>
          <input id="cep" name="cep" inputMode="numeric" autoComplete="postal-code" className={CLASSE_CAMPO} />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="logradouro" className={CLASSE_ROTULO}>
            Endereço
          </label>
          <input id="logradouro" name="logradouro" maxLength={200} autoComplete="street-address" className={CLASSE_CAMPO} />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="numero" className={CLASSE_ROTULO}>
            Nº
          </label>
          <input id="numero" name="numero" maxLength={20} className={CLASSE_CAMPO} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="complemento" className={CLASSE_ROTULO}>
            Complemento
          </label>
          <input id="complemento" name="complemento" maxLength={100} className={CLASSE_CAMPO} />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="bairro" className={CLASSE_ROTULO}>
            Bairro
          </label>
          <input id="bairro" name="bairro" maxLength={100} className={CLASSE_CAMPO} />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="cidade" className={CLASSE_ROTULO}>
            Cidade
          </label>
          <input id="cidade" name="cidade" maxLength={100} className={CLASSE_CAMPO} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="uf" className={CLASSE_ROTULO}>
            Estado
          </label>
          <select id="uf" name="uf" className={CLASSE_CAMPO} defaultValue="">
            <option value="">UF</option>
            {"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
              .split(" ")
              .map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
          </select>
        </div>
      </div>

      {estado.erro && (
        <p role="alert" className="mt-5 rounded-lg bg-alerta-fundo px-3 py-2 text-sm font-medium text-alerta-texto">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 h-12 w-full rounded-full bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {enviando ? "Enviando…" : "Enviar cadastro"}
      </button>

      <p className="mt-3 text-xs leading-relaxed text-suave">
        Usamos esses dados só para liberar o seu acesso e faturar os pedidos.
        Nada de spam.
      </p>
    </form>
  );
}

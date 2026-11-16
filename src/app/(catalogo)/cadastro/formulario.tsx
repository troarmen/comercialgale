"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { linkWhatsApp } from "@/lib/contato";
import { cadastrarLojista, type EstadoCadastro } from "./acoes";

const CLASSE_CAMPO =
  "h-11 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";
const CLASSE_ROTULO = "mb-1.5 block text-sm font-medium text-texto";

export function FormularioCadastro({
  carimbo,
  automatico,
}: {
  /** horário do desenho do formulário, assinado (ver servidor.ts) */
  carimbo: string;
  /** Configurações → "Liberar cadastro automaticamente" */
  automatico: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoCadastro, FormData>(
    cadastrarLojista,
    { ok: false },
  );
  const [tipoPessoa, setTipoPessoa] = useState<"juridica" | "fisica">("juridica");

  // Só chega aqui o "ok" do honeypot (robô) — o cadastro de verdade termina
  // com redirect para /cadastro/bem-vindo, já logado.
  if (estado.ok) {
    return (
      <div className="rounded-2xl border border-borda/60 bg-superficie p-8 text-center shadow-suave">
        <h2 className="text-xl font-bold tracking-tight text-texto">Cadastro enviado!</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-suave">
          Se precisar de ajuda, fale com a nossa equipe pelo WhatsApp.
        </p>
        <Link
          href="/produtos"
          className="mx-auto mt-6 flex h-11 w-fit items-center rounded-full bg-acento px-6 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          Ver o catálogo
        </Link>
      </div>
    );
  }

  return (
    <form
      action={enviar}
      // O React 19 LIMPA o formulário depois de toda action chamada pelo
      // `action` — inclusive quando ela volta com erro: o lojista perderia
      // tudo que digitou por causa de um CPF errado. Interceptando o submit e
      // chamando a action numa transição, nada é apagado. O `action` fica
      // para o envio funcionar mesmo antes de o JavaScript carregar.
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
      className="rounded-2xl border border-borda/60 bg-superficie p-6 shadow-suave sm:p-8"
    >
      {/* Honeypot anti-robô: fica fora da tela e fora da ordem de tabulação */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Não preencha este campo
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="inicio" value={carimbo} />

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
          {/* CNPJ sem teclado numérico: desde jul/2026 a Receita emite CNPJ
              com letras (ver src/lib/validacao.ts). */}
          <input
            id="documento"
            name="documento"
            required
            maxLength={20}
            inputMode={tipoPessoa === "juridica" ? "text" : "numeric"}
            autoCapitalize="characters"
            autoComplete="off"
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

      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wider text-tenue">
        Seu acesso
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-suave">
        Você entra no site com o e-mail acima e esta senha.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="senha" className={CLASSE_ROTULO}>
            Crie uma senha *
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            aria-describedby="senha-dica"
            className={CLASSE_CAMPO}
          />
          <p id="senha-dica" className="mt-1 text-xs text-suave">
            Pelo menos 8 caracteres.
          </p>
        </div>
        <div>
          <label htmlFor="confirmacao" className={CLASSE_ROTULO}>
            Confirme a senha *
          </label>
          <input
            id="confirmacao"
            name="confirmacao"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            className={CLASSE_CAMPO}
          />
        </div>
      </div>

      {estado.erro && (
        <div role="alert" className="mt-5 rounded-lg bg-alerta-fundo px-3 py-2.5 text-sm font-medium text-alerta-texto">
          <p>{estado.erro}</p>
          {estado.saida === "entrar" && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/entrar" className="font-semibold underline underline-offset-2">
                Entrar
              </Link>
              <Link href="/esqueci-senha" className="font-semibold underline underline-offset-2">
                Esqueci minha senha
              </Link>
            </p>
          )}
          {estado.saida === "whatsapp" && (
            <p className="mt-2">
              <a
                href={linkWhatsApp("Olá! Tentei fazer o cadastro pelo site e o meu documento já tem ficha na Galé. Pode liberar o meu acesso?")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                Falar no WhatsApp
              </a>
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 h-12 w-full rounded-full bg-acento text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {enviando
          ? "Criando a sua conta…"
          : automatico
            ? "Criar conta e ver os preços"
            : "Criar conta"}
      </button>

      <p className="mt-3 text-xs leading-relaxed text-suave">
        Usamos esses dados só para o seu acesso e para faturar os pedidos.
        Nada de spam.
      </p>
    </form>
  );
}

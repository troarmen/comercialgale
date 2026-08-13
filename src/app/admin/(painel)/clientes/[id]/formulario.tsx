"use client";

import { useActionState } from "react";
import { Aviso, BotaoSalvar, CAMPO, Interruptor } from "@/components/cadastro-ui";
import type { Resultado } from "./acoes";

export type DadosCliente = {
  id: number;
  nome: string;
  nome_fantasia: string | null;
  tipo_pessoa: "fisica" | "juridica";
  status: "ativo" | "inativo" | "incompleto";
  documento: string | null;
  inscricao_estadual: string | null;
  rg: string | null;
  email: string | null;
  telefone1: string | null;
  telefone2: string | null;
  nome_contato: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  pode_ver_precos: boolean;
};

function Campo({
  nome,
  rotulo,
  valor,
  largura = "",
  ...resto
}: {
  nome: string;
  rotulo: string;
  valor: string | null;
  largura?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-1.5 ${largura}`}>
      <span className="text-sm font-medium text-texto">{rotulo}</span>
      <input name={nome} defaultValue={valor ?? ""} className={CAMPO} {...resto} />
    </label>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-5">
      <h2 className="mb-4 text-sm font-semibold text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

/** Cliente em branco, para a tela de cadastro novo. */
export const CLIENTE_VAZIO: DadosCliente = {
  id: 0, nome: "", nome_fantasia: null, tipo_pessoa: "fisica", status: "ativo",
  documento: null, inscricao_estadual: null, rg: null, email: null,
  telefone1: null, telefone2: null, nome_contato: null, cep: null,
  logradouro: null, numero: null, complemento: null, bairro: null,
  cidade: null, uf: null, observacoes: null, pode_ver_precos: true,
};

export function FormularioCliente({
  c,
  aoSalvar,
  rotulo = "Salvar alterações",
}: {
  c: DadosCliente;
  /** A ação muda entre criar e editar; o formulário é o mesmo. */
  aoSalvar: (anterior: Resultado, form: FormData) => Promise<Resultado>;
  rotulo?: string;
}) {
  const [estado, acao] = useActionState<Resultado, FormData>(aoSalvar, {});

  return (
    <form action={acao} className="space-y-4">
      {c.id > 0 && <input type="hidden" name="id" value={c.id} />}

      <Secao titulo="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Tipo</span>
            <select name="tipo_pessoa" defaultValue={c.tipo_pessoa} className={CAMPO}>
              <option value="fisica">Pessoa física</option>
              <option value="juridica">Pessoa jurídica</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Situação</span>
            <select name="status" defaultValue={c.status} className={CAMPO}>
              <option value="ativo">Ativo</option>
              <option value="incompleto">Cadastro incompleto</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
          <Campo nome="nome" rotulo="Nome / Razão social" valor={c.nome} required largura="sm:col-span-2" />
          <Campo nome="nome_fantasia" rotulo="Nome fantasia" valor={c.nome_fantasia} />
          <Campo nome="documento" rotulo="CPF / CNPJ" valor={c.documento} inputMode="numeric" />
          <Campo nome="rg" rotulo="RG" valor={c.rg} />
          <Campo nome="inscricao_estadual" rotulo="Inscrição estadual" valor={c.inscricao_estadual} />
        </div>
      </Secao>

      <Secao titulo="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="email" rotulo="E-mail" valor={c.email} type="email" largura="sm:col-span-2" />
          <Campo nome="telefone1" rotulo="Telefone principal" valor={c.telefone1} />
          <Campo nome="telefone2" rotulo="Telefone 2" valor={c.telefone2} />
          <Campo nome="nome_contato" rotulo="Nome de contato" valor={c.nome_contato} largura="sm:col-span-2" />
        </div>
      </Secao>

      <Secao titulo="Endereço de entrega">
        <div className="grid gap-4 sm:grid-cols-6">
          <Campo nome="cep" rotulo="CEP" valor={c.cep} largura="sm:col-span-2" />
          <Campo nome="logradouro" rotulo="Logradouro" valor={c.logradouro} largura="sm:col-span-4" />
          <Campo nome="numero" rotulo="Número" valor={c.numero} largura="sm:col-span-2" />
          <Campo nome="complemento" rotulo="Complemento" valor={c.complemento} largura="sm:col-span-4" />
          <Campo nome="bairro" rotulo="Bairro" valor={c.bairro} largura="sm:col-span-3" />
          <Campo nome="cidade" rotulo="Cidade" valor={c.cidade} largura="sm:col-span-2" />
          <Campo nome="uf" rotulo="UF" valor={c.uf} maxLength={2} largura="sm:col-span-1" />
        </div>
      </Secao>

      <Secao titulo="Interno">
        <div className="space-y-4">
          <Interruptor
            nome="pode_ver_precos"
            marcado={c.pode_ver_precos}
            rotulo="Pode ver os preços no catálogo"
          />
          <p className="-mt-2 text-xs leading-relaxed text-tenue">
            Desligar suspende os preços sem tirar o login. Útil para cliente
            inadimplente que você não quer bloquear de vez.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Anotações</span>
            <textarea
              name="observacoes"
              defaultValue={c.observacoes ?? ""}
              rows={3}
              placeholder="Histórico, combinados, formas de pagamento…"
              className={`${CAMPO} h-auto py-2.5`}
            />
            <span className="text-xs text-tenue">Só o painel vê.</span>
          </label>
        </div>
      </Secao>

      {estado.erro && <Aviso mensagem={estado.erro} />}

      <div className="flex items-center gap-3">
        <BotaoSalvar rotulo={rotulo} />
        {estado.ok && (
          <span role="status" className="text-sm font-medium text-ok-texto">
            Salvo.
          </span>
        )}
      </div>
    </form>
  );
}

"use client";

import { startTransition, useActionState, useState } from "react";
import { salvarConfiguracoes, type EstadoConfig } from "./acoes";

const CAMPO =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-5">
      <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
      <p className="mt-1 mb-4 max-w-xl text-sm leading-relaxed text-suave">
        {descricao}
      </p>
      {children}
    </section>
  );
}

/**
 * Chave liga/desliga. A bolinha anda pelo `[&>span]`: `peer-checked:` só
 * enxerga IRMÃOS do input, e a bolinha é filha do trilho — com a classe nela
 * direto (como estava), o trilho mudava de cor e a bolinha ficava parada.
 */
function Interruptor({
  nome,
  ligado,
  rotulo,
}: {
  nome: string;
  ligado: boolean;
  rotulo: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="checkbox" name={nome} defaultChecked={ligado} className="peer sr-only" />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-borda-forte transition peer-checked:bg-acento peer-checked:[&>span]:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gale-500">
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition" />
      </span>
      <span className="text-sm text-texto">{rotulo}</span>
    </label>
  );
}

export function FormularioConfiguracoes({
  minimo,
  emails,
  aviso,
  exibirVarejo,
  cadastroAutomatico,
}: {
  minimo: number;
  emails: string[];
  aviso: string;
  exibirVarejo: boolean;
  cadastroAutomatico: boolean;
}) {
  const [estado, acao, salvando] = useActionState<EstadoConfig, FormData>(
    salvarConfiguracoes,
    {},
  );
  const [contador, setContador] = useState(aviso.length);

  return (
    <form
      action={acao}
      // O React 19 devolve todo campo ao valor inicial depois de uma action
      // passada em `action` — também quando ela volta com ERRO: um e-mail
      // digitado errado sumia junto com a mensagem, e o contador do aviso
      // ficava descolado do texto. Interceptando o submit e chamando a action
      // numa transição, o que foi digitado fica onde está.
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => acao(dados));
      }}
      className="flex max-w-3xl flex-col gap-4"
    >
      <Secao
        titulo="Cadastro de lojistas"
        descricao="Ligado, quem se cadastra pelo site cria a senha e já entra vendo os preços — vocês recebem o aviso por e-mail e podem suspender na ficha. Desligado, o lojista cria login e senha do mesmo jeito, mas só vê preço depois que alguém mudar a situação dele para Ativo na ficha."
      >
        <Interruptor
          nome="cadastro_aprovacao_automatica"
          ligado={cadastroAutomatico}
          rotulo="Liberar cadastro automaticamente"
        />
      </Secao>

      <Secao
        titulo="Pedido mínimo"
        descricao="Valor de referência das compras no atacado. Abaixo dele o carrinho mostra um aviso, mas o pedido fecha normalmente. Deixe em branco ou zero para não mostrar aviso."
      >
        <div className="relative w-48">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-suave">
            R$
          </span>
          <input
            name="pedido_minimo_valor"
            defaultValue={minimo ? minimo.toFixed(2).replace(".", ",") : ""}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Valor mínimo do pedido em reais"
            className={`${CAMPO} pl-9 tabular-nums`}
          />
        </div>
      </Secao>

      <Secao
        titulo="Avisos por e-mail"
        descricao="Quem recebe uma cópia de cada pedido novo e o aviso de cada cadastro novo. Um endereço por linha. O cliente que fez o pedido também recebe a confirmação, sempre."
      >
        <textarea
          name="emails_notificacao"
          defaultValue={emails.join("\n")}
          rows={3}
          placeholder="contato@comercialgale.com.br"
          aria-label="E-mails que recebem cópia dos pedidos e aviso de cadastro"
          className={`${CAMPO} h-auto py-2.5 font-mono text-[13px] leading-relaxed`}
        />
      </Secao>

      <Secao
        titulo="Preço de Varejo"
        descricao="Mostra ao lojista, ao lado do preço de Atacado, o preço de Varejo (o das compras abaixo do pedido mínimo). Desligar esconde o Varejo do catálogo e do e-mail de confirmação do lojista — a cópia da casa e os pedidos antigos continuam guardando o valor."
      >
        <Interruptor
          nome="exibir_preco_varejo"
          ligado={exibirVarejo}
          rotulo="Exibir preço de Varejo no catálogo"
        />
      </Secao>

      <Secao
        titulo="Aviso no topo do catálogo"
        descricao="Uma linha exibida para todos os clientes assim que entram. Serve para avisar de férias coletivas, prazo de entrega ou uma promoção. Deixe vazio para não mostrar nada."
      >
        <textarea
          name="catalogo_aviso"
          defaultValue={aviso}
          onChange={(e) => setContador(e.target.value.length)}
          rows={2}
          maxLength={280}
          placeholder="Ex: Entregas suspensas entre 20 e 30 de dezembro."
          aria-label="Aviso exibido no topo do catálogo"
          className={`${CAMPO} h-auto py-2.5`}
        />
        <p className="mt-1.5 text-right text-xs tabular-nums text-tenue">
          {contador}/280
        </p>
      </Secao>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={salvando}
          className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
        {!salvando && estado.ok && (
          <span role="status" className="text-sm font-medium text-ok-texto">
            Alterações salvas.
          </span>
        )}
        {!salvando && estado.erro && (
          <span role="alert" className="text-sm font-medium text-acento-texto">
            {estado.erro}
          </span>
        )}
      </div>
    </form>
  );
}

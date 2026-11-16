"use client";

import { unstable_rethrow } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { useFormStatus } from "react-dom";

/** Estilo único dos campos das telas de cadastro. */
export const CAMPO =
  "h-10 w-full rounded-lg border border-borda bg-superficie px-3 text-sm text-texto outline-none transition placeholder:text-tenue focus:border-gale-500";

/**
 * Liga um formulário a uma Server Action SEM o reset automático do React 19.
 *
 * Com `<form action={...}>`, o React limpa o formulário assim que a action
 * termina — com sucesso e também quando ela devolve erro. Limpar, ali, é
 * voltar cada campo ao valor com que a TELA ABRIU, não ao que acabou de ser
 * gravado: um <select> não controlado volta à opção antiga e um <select>
 * controlado volta à primeira opção ("Escolha…"). Foi assim que o produto
 * "perdia" a categoria e o kit ao salvar (relatório do cliente, nov/2026), e
 * o fabricante trocado voltava ao anterior na tela — um segundo Salvar
 * gravaria o valor velho por cima. Com erro, o reset apagava o que a pessoa
 * tinha acabado de digitar.
 *
 * Aqui o envio passa pelo onSubmit: o navegador continua validando os campos
 * `required` antes, nós montamos o FormData e chamamos a action dentro de uma
 * transição. Sem `action` no <form>, o React não tem o que resetar. O
 * useFormStatus do BotaoSalvar segue acendendo "Salvando…" (o React marca o
 * formulário como pendente quando o onSubmit abre uma transição), e o
 * `pendente` devolvido aqui cobre quem preferir passar o estado à mão.
 *
 * Uso: `const [estado, aoEnviar, pendente] = useEnvio(acao, {});`
 *      `<form onSubmit={aoEnviar}>`
 */
export function useEnvio<E extends { ok?: boolean; erro?: string }>(
  acao: (anterior: E, form: FormData) => Promise<E>,
  inicial: E,
) {
  const [estado, despachar, pendente] = useActionState<E, FormData>(
    async (anterior, form) => {
      try {
        return await acao(anterior, form);
      } catch (erro) {
        // redirect() da action (cadastro novo → ficha) chega aqui como erro
        // e precisa seguir para o roteador do Next.
        unstable_rethrow(erro);
        // Queda de rede ou falha inesperada no servidor: sem este catch o
        // erro subia até a tela de erro do Next e levava junto tudo o que
        // estava digitado. Assim o formulário fica como está, com o aviso.
        return { ...anterior, ok: false, erro: FALHA_ENVIO };
      }
    },
    inicial as Awaited<E>,
  );

  function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendente) return; // duplo Enter não grava duas vezes
    const dados = new FormData(evento.currentTarget);
    startTransition(() => despachar(dados));
  }

  return [estado, aoEnviar, pendente] as const;
}

const FALHA_ENVIO =
  "Não foi possível falar com o servidor, então nada foi salvo. Confira a internet e clique em salvar de novo — o que você preencheu continua aqui.";

const nadaParaAssinar = () => () => {};

/**
 * `false` no HTML do servidor e até a página hidratar; `true` depois.
 *
 * Os formulários enviam por onSubmit (ver useEnvio). Antes da hidratação esse
 * onSubmit ainda não existe, e um clique em Salvar faria o envio nativo do
 * navegador: GET na própria página com todos os campos — preços inclusive —
 * na barra de endereço, e nada gravado. Com o botão desabilitado até
 * hidratar, nem o clique nem o Enter num campo enviam nada (o navegador não
 * faz o envio implícito quando o botão padrão do form está desabilitado).
 */
export function useHidratado() {
  return useSyncExternalStore(
    nadaParaAssinar,
    () => true,
    () => false,
  );
}

export function BotaoSalvar({
  rotulo = "Salvar",
  salvando = false,
}: {
  rotulo?: string;
  /** Estado de envio vindo de `useEnvio`, para não depender só do formulário. */
  salvando?: boolean;
}) {
  const { pending } = useFormStatus();
  const hidratado = useHidratado();
  const ocupado = pending || salvando;
  return (
    <button
      type="submit"
      disabled={ocupado || !hidratado}
      className="h-10 rounded-lg bg-acento px-5 text-sm font-semibold text-white transition hover:bg-acento-forte disabled:opacity-60"
    >
      {ocupado ? "Salvando…" : rotulo}
    </button>
  );
}

export function BotaoNovo({
  rotulo,
  aoClicar,
}: {
  rotulo: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="flex h-9 items-center gap-1.5 rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {rotulo}
    </button>
  );
}

/** Interruptor de ativo/inativo usado em todos os cadastros. */
export function Interruptor({
  nome,
  marcado,
  rotulo,
}: {
  nome: string;
  marcado: boolean;
  rotulo: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" name={nome} defaultChecked={marcado} className="peer sr-only" />
      {/* A bolinha não é irmã do input, então o peer-checked vai no trilho
          (que é) e alcança a bolinha pelo [&>span]. */}
      <span className="relative h-6 w-11 rounded-full bg-borda-forte transition peer-checked:bg-acento peer-checked:[&>span]:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gale-500">
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition" />
      </span>
      <span className="text-sm">{rotulo}</span>
    </label>
  );
}

/** Etiqueta de situação, clicável para alternar. */
export function EtiquetaAtivo({
  ativo,
  aoAlternar,
}: {
  ativo: boolean;
  aoAlternar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      title={ativo ? "Esconder do catálogo" : "Mostrar no catálogo"}
      className="cursor-pointer"
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition ${
          ativo ? "bg-ok-fundo text-ok-texto" : "bg-tenue/15 text-suave"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-ok-texto" : "bg-tenue"}`} />
        {ativo ? "Sim" : "Não"}
      </span>
    </button>
  );
}

/**
 * Janela modal dos formulários de cadastro. Usa o <dialog> nativo, que já traz
 * de graça o fechamento com Esc, o foco preso dentro e o fundo escurecido.
 */
export function Modal({
  titulo,
  aoFechar,
  fecharQuando,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  fecharQuando: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (fecharQuando) aoFechar();
  }, [fecharQuando, aoFechar]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl bg-superficie p-0 text-texto backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </dialog>
  );
}

export function BotaoCancelar({ aoClicar }: { aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="h-10 rounded-lg px-4 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
    >
      Cancelar
    </button>
  );
}

export function Aviso({ mensagem }: { mensagem: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-acento-texto/40 bg-acento-texto/10 px-3.5 py-2.5 text-sm text-acento-texto"
    >
      {mensagem}
    </p>
  );
}

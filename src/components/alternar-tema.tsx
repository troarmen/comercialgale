"use client";

import { useSyncExternalStore } from "react";

type Tema = "claro" | "escuro";

const EVENTO = "tema:mudou";
const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

/**
 * Script injetado no <head>, antes de qualquer pintura.
 *
 * Sem isso a página nasce clara e "pisca" para escura quando o React assume —
 * o famoso flash branco. Como roda de forma síncrona antes do primeiro paint,
 * o navegador já desenha na cor certa.
 */
export const scriptTema = `
(function(){try{
  var t = localStorage.getItem('tema');
  if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t;
}catch(e){}})();
`;

/*
 * O tema não é estado do React: mora no atributo do <html> e na preferência do
 * sistema operacional. `useSyncExternalStore` é o jeito de ler uma fonte
 * externa dessas sem espelhar em estado e sem cair em efeito colateral.
 */
function subscrever(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_ESCURO);
  consulta.addEventListener("change", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    consulta.removeEventListener("change", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

function lerNavegador(): Tema {
  const escolhido = document.documentElement.dataset.tema;
  if (escolhido === "claro" || escolhido === "escuro") return escolhido;
  return window.matchMedia(CONSULTA_ESCURO).matches ? "escuro" : "claro";
}

// No servidor não há como saber o tema de quem vai abrir a página. Devolvemos
// null e o botão renderiza um espaço vazio até hidratar — melhor do que chutar
// um ícone e trocar na frente do usuário.
const lerServidor = (): Tema | null => null;

export function AlternarTema() {
  const tema = useSyncExternalStore(subscrever, lerNavegador, lerServidor);

  function alternar() {
    const novo: Tema = tema === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {
      // navegação anônima com armazenamento bloqueado: vale só nesta aba
    }
    window.dispatchEvent(new Event(EVENTO));
  }

  const rotulo =
    tema === "escuro" ? "Mudar para tema claro" : "Mudar para tema escuro";

  return (
    <button
      type="button"
      onClick={alternar}
      title={rotulo}
      aria-label={rotulo}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-menu-texto transition hover:bg-menu-ativo hover:text-white"
    >
      {tema === null ? (
        <span className="h-[18px] w-[18px]" />
      ) : tema === "escuro" ? (
        <Sol />
      ) : (
        <Lua />
      )}
    </button>
  );
}

function Lua() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M17 11.4A7.5 7.5 0 0 1 8.6 3a7.5 7.5 0 1 0 8.4 8.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sol() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.8v1.8M10 16.4v1.8M18.2 10h-1.8M3.6 10H1.8M15.8 4.2l-1.3 1.3M5.5 14.5l-1.3 1.3M15.8 15.8l-1.3-1.3M5.5 5.5 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

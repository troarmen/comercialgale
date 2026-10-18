"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/*
 * Porteiro do fundo líquido.
 *
 * O efeito custa um pacote de ~150 KB comprimidos (three.js) e um laço de GPU.
 * Este componente decide, no navegador, se vale a conta — e só então baixa o
 * arquivo pesado, depois que a página já está pronta (idle). Quem não passa
 * fica com a aurora em CSS que a seção pinta por baixo; ninguém vê um buraco.
 *
 * Não entra quando:
 *  - o visitante pediu menos movimento (prefers-reduced-motion);
 *  - o ponteiro é grosso (toque) ou a tela é estreita — no celular o banner é
 *    só texto, não há "palco" para o fluido, e bateria é cara;
 *  - o navegador avisa economia de dados ou pouca memória;
 *  - não há WebGL.
 */
const FundoLiquido = dynamic(() => import("./fundo-liquido"), { ssr: false });

type NavegadorComDicas = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

function merece(): boolean {
  const mq = (q: string) => window.matchMedia(q).matches;
  if (mq("(prefers-reduced-motion: reduce)")) return false;
  if (!mq("(pointer: fine)") || !mq("(min-width: 1024px)")) return false;

  const nav = navigator as NavegadorComDicas;
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;

  const sonda = document.createElement("canvas");
  return !!(sonda.getContext("webgl2") ?? sonda.getContext("webgl"));
}

export function FundoLiquidoLazy(props: { className?: string }) {
  const [ligado, setLigado] = useState(false);

  useEffect(() => {
    if (!merece()) return;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setLigado(true), { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setLigado(true), 800);
    return () => window.clearTimeout(id);
  }, []);

  if (!ligado) return null;
  return <FundoLiquido className={props.className} />;
}

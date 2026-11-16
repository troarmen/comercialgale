"use client";

import Image from "next/image";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as EventoPonteiro,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";

export type FotoAmpliavel = { id: number; url: string; alt: string | null };

/**
 * Visualizador de foto em tela cheia, com zoom — aberto pela galeria da ficha.
 *
 * As fotos são WebP de até 800×800 servidas direto do Storage (o otimizador
 * do Next está desligado, ver next.config.ts). Não existe versão maior: o
 * zoom só amplia o MESMO arquivo que a ficha já baixou, então abrir o
 * visualizador não custa nenhuma requisição nova. Por isso também a foto
 * nunca abre maior que o tamanho original: na tela de um monitor grande ela
 * pararia em 800 px em vez de esticar e fingir uma nitidez que não tem.
 *
 * O zoom é só `transform` (translate + scale) escrito direto no estilo do
 * elemento, fora do React: arrastar e fazer pinça mexem apenas no compositor,
 * sem layout e sem re-renderizar a árvore a cada movimento do dedo. O estado
 * do React guarda só o que muda o desenho dos controles (ampliada ou não,
 * zoom no máximo, arrastando).
 */

const ESCALA_MIN = 1;
const ESCALA_MAX = 4;
/** Zoom de um clique/toque. 2,5× mostra costura e etiqueta sem perder o contexto. */
const ESCALA_CLIQUE = 2.5;
/** Cada aperto nos botões +/− (e nas teclas) multiplica ou divide por isto. */
const PASSO_BOTAO = 1.5;
/** Até quantos px o dedo pode escorregar e ainda contar como toque. */
const LIMIAR_ARRASTE = 6;
/** Segundo toque dentro desta janela (ms) e distância (px) é o duplo toque. */
const JANELA_DUPLO = 300;
const DISTANCIA_DUPLO = 40;
/** Deslize horizontal mínimo, com a foto ajustada, para trocar de foto. */
const LIMIAR_DESLIZE = 60;
/** Antes da foto carregar presume-se o tamanho da migração (800×800). */
const TAMANHO_PADRAO: Tamanho = { w: 800, h: 800 };
const VISTA_INICIAL: Vista = { s: 1, x: 0, y: 0 };
const CURVA = "cubic-bezier(0.2, 0.8, 0.2, 1)";

type Tamanho = { w: number; h: number };
type Ponto = { x: number; y: number };
/** Escala e deslocamento (px) da foto em relação à posição ajustada. */
type Vista = { s: number; x: number; y: number };
/**
 * Geometria medida no palco: tamanho da foto em 1× (w, h), centro da área
 * útil onde ela fica ajustada (cx, cy), tamanho do palco (W, H) e onde o
 * palco começa na janela (ox, oy) — tudo lido uma vez por redimensionamento.
 */
type Caixa = { w: number; h: number; cx: number; cy: number; W: number; H: number; ox: number; oy: number };

type Gesto =
  | {
      tipo: "um";
      inicio: Ponto;
      vista0: Vista;
      movido: boolean;
      /** Sobrou um dedo depois de uma pinça: continua arrastando, nunca é toque. */
      depoisDaPinca: boolean;
    }
  | { tipo: "pinca"; distancia0: number; meio0: Ponto; vista0: Vista };

type Estado = {
  vista: Vista;
  caixa: Caixa | null;
  natural: Tamanho;
  ponteiros: Map<number, Ponto>;
  gesto: Gesto | null;
  ultimoToque: { t: number; x: number; y: number } | null;
  fecharNoClique: boolean;
};

// ------------------------------------------------------------ geometria pura

function limitarEscala(s: number) {
  return Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, s));
}

/**
 * Limita o deslocamento num eixo. Foto MENOR que o palco fica centrada na área
 * útil (empurrada só o necessário para não sair da tela); foto MAIOR que o
 * palco pode andar, mas nunca deixa faixa vazia na borda.
 */
function limitarEixo(t: number, tamanho: number, centro: number, total: number) {
  const encostaInicio = tamanho / 2 - centro; // borda da foto em 0
  const encostaFim = total - centro - tamanho / 2; // borda da foto em `total`
  if (tamanho <= total) return Math.min(Math.max(0, encostaInicio), encostaFim);
  return Math.min(Math.max(t, encostaFim), encostaInicio);
}

function limitar(v: Vista, c: Caixa): Vista {
  const s = limitarEscala(v.s);
  return { s, x: limitarEixo(v.x, c.w * s, c.cx, c.W), y: limitarEixo(v.y, c.h * s, c.cy, c.H) };
}

/** Nova escala mantendo parado, sob o cursor/dedo, o ponto (px, py) da foto. */
function zoomNoPonto(v: Vista, c: Caixa, s1: number, px: number, py: number): Vista {
  const s = limitarEscala(s1);
  const lx = (px - c.cx - v.x) / v.s;
  const ly = (py - c.cy - v.y) / v.s;
  return limitar({ s, x: px - c.cx - s * lx, y: py - c.cy - s * ly }, c);
}

function dentroDaFoto(v: Vista, c: Caixa, p: Ponto) {
  return Math.abs(p.x - c.cx - v.x) <= (c.w * v.s) / 2 && Math.abs(p.y - c.cy - v.y) <= (c.h * v.s) / 2;
}

function distancia(a: Ponto, b: Ponto) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function meio(a: Ponto, b: Ponto): Ponto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function movimentoReduzido() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// --------------------------------------------------- escrita direta no DOM

/** Só transform (e a opacidade da entrada): o compositor resolve sozinho. */
function pintar(el: HTMLElement, v: Vista, animar: boolean) {
  const suave = animar && !movimentoReduzido();
  el.style.transition = suave
    ? `transform 240ms ${CURVA}, opacity 160ms ease-out`
    : "opacity 160ms ease-out";
  el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`;
}

/**
 * Mede o palco e a área útil e reposiciona a foto. A área útil é um <div>
 * invisível com as margens em CSS (barra de cima, miniaturas embaixo, setas
 * nas laterais) — assim o layout dos controles muda só no JSX, sem número
 * mágico repetido aqui. Roda na abertura, ao trocar de foto e ao redimensionar.
 */
function reencaixar(e: Estado, palco: HTMLElement | null, area: HTMLElement | null, foto: HTMLElement | null) {
  if (!palco || !area || !foto) return;
  const r = palco.getBoundingClientRect();
  const aw = area.offsetWidth;
  const ah = area.offsetHeight;
  const k = Math.min(aw / e.natural.w, ah / e.natural.h, 1);
  const c: Caixa = {
    w: e.natural.w * k,
    h: e.natural.h * k,
    cx: area.offsetLeft + aw / 2,
    cy: area.offsetTop + ah / 2,
    W: r.width,
    H: r.height,
    ox: r.left,
    oy: r.top,
  };
  e.caixa = c;
  foto.style.width = `${c.w}px`;
  foto.style.height = `${c.h}px`;
  foto.style.left = `${c.cx - c.w / 2}px`;
  foto.style.top = `${c.cy - c.h / 2}px`;
  e.vista = limitar(e.vista, c);
  pintar(foto, e.vista, false);
}

function focaveis(raiz: HTMLElement) {
  return Array.from(
    raiz.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0);
}

// ---------------------------------------------------------------- componente

export function VisualizadorFoto({
  fotos,
  titulo,
  indice,
  aoTrocar,
  aoFechar,
  origem,
}: {
  fotos: FotoAmpliavel[];
  titulo: string;
  indice: number;
  aoTrocar: (indice: number) => void;
  aoFechar: () => void;
  /** Quem abriu o visualizador: recebe o foco de volta ao fechar. */
  origem: RefObject<HTMLElement | null>;
}) {
  const total = fotos.length;
  const foto = fotos[indice];

  const dialogoRef = useRef<HTMLDialogElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const fotoRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const faixaRef = useRef<HTMLDivElement>(null);
  const estado = useRef<Estado>({
    vista: VISTA_INICIAL,
    caixa: null,
    natural: TAMANHO_PADRAO,
    ponteiros: new Map(),
    gesto: null,
    ultimoToque: null,
    fecharNoClique: false,
  });

  const [ampliada, setAmpliada] = useState(false);
  const [noMaximo, setNoMaximo] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  // Trocou de foto? Os controles voltam ao estado de foto ajustada. Ajuste de
  // estado DURANTE a renderização (padrão do React para reagir a prop nova).
  const [fotoAnterior, setFotoAnterior] = useState(foto.id);
  if (foto.id !== fotoAnterior) {
    setFotoAnterior(foto.id);
    setAmpliada(false);
    setNoMaximo(false);
    setArrastando(false);
  }

  /** Aplica uma vista nova à foto e sincroniza os controles. */
  function definir(v: Vista, animar: boolean) {
    estado.current.vista = v;
    if (fotoRef.current) pintar(fotoRef.current, v, animar);
    setAmpliada(v.s > 1.001);
    setNoMaximo(v.s >= ESCALA_MAX - 0.001);
  }

  function ajustar(animar: boolean) {
    const c = estado.current.caixa;
    definir(c ? limitar(VISTA_INICIAL, c) : VISTA_INICIAL, animar);
  }

  function navegar(passo: number) {
    if (total < 2) return;
    aoTrocar((indice + passo + total) % total);
  }

  /** Botões e teclas +/−: amplia a partir do centro do que está na tela. */
  function zoomPasso(fator: number) {
    const { vista, caixa } = estado.current;
    if (!caixa) return;
    const s1 = limitarEscala(vista.s * fator);
    if (s1 < 1.05) return ajustar(true);
    definir(zoomNoPonto(vista, caixa, s1, caixa.cx, caixa.cy), true);
  }

  // Abertura: modal nativo (camada de topo, fundo inerte), página travada e
  // foco no botão de fechar. Ao desmontar, tudo volta e o foco retorna à foto
  // da ficha — chamado depois do close(), quando a página já não está inerte.
  useLayoutEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return;
    const alvoDoFoco = origem.current;
    const corpo = document.body;
    const anterior = { overflow: corpo.style.overflow, paddingRight: corpo.style.paddingRight };
    // Sem a barra de rolagem a página alarga; o recuo segura o conteúdo no
    // lugar para nada "pular" atrás do fundo translúcido.
    const barra = window.innerWidth - document.documentElement.clientWidth;
    corpo.style.overflow = "hidden";
    if (barra > 0) corpo.style.paddingRight = `${barra}px`;
    if (!dialogo.open) dialogo.showModal();
    fecharRef.current?.focus();
    return () => {
      if (dialogo.open) dialogo.close();
      corpo.style.overflow = anterior.overflow;
      corpo.style.paddingRight = anterior.paddingRight;
      alvoDoFoco?.focus({ preventScroll: true });
    };
  }, [origem]);

  // Foto nova (abertura ou troca): começa ajustada, com o tamanho presumido
  // até o arquivo carregar e informar o tamanho real.
  useLayoutEffect(() => {
    const e = estado.current;
    e.vista = VISTA_INICIAL;
    e.natural = TAMANHO_PADRAO;
    e.ponteiros.clear();
    e.gesto = null;
    e.ultimoToque = null;
    reencaixar(e, palcoRef.current, areaRef.current, fotoRef.current);
  }, [foto.id]);

  // Girou o celular ou redimensionou a janela: mede de novo.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observador = new ResizeObserver(() =>
      reencaixar(estado.current, palcoRef.current, areaRef.current, fotoRef.current),
    );
    observador.observe(area);
    return () => observador.disconnect();
  }, []);

  // Mantém a miniatura da foto atual visível na faixa (rola só a faixa,
  // nunca a página).
  useLayoutEffect(() => {
    const faixa = faixaRef.current;
    const atual = faixa?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!faixa || !atual) return;
    const alvo = atual.offsetLeft - (faixa.clientWidth - atual.offsetWidth) / 2;
    faixa.scrollTo({ left: alvo, behavior: movimentoReduzido() ? "auto" : "smooth" });
  }, [indice]);

  // Roda do mouse (e pinça do trackpad, que chega como wheel + ctrl). Precisa
  // de ouvinte nativo não passivo: o do React é passivo e não impediria o
  // navegador de dar zoom na página inteira.
  const aoRodar = useEffectEvent((ev: WheelEvent) => {
    ev.preventDefault();
    const { vista, caixa } = estado.current;
    if (!caixa) return;
    let delta = ev.deltaY;
    if (ev.deltaMode === 1) delta *= 16;
    else if (ev.deltaMode === 2) delta *= caixa.H;
    const s1 = limitarEscala(vista.s * Math.exp(-delta * (ev.ctrlKey ? 0.01 : 0.002)));
    if (s1 === vista.s) return;
    definir(zoomNoPonto(vista, caixa, s1, ev.clientX - caixa.ox, ev.clientY - caixa.oy), false);
  });

  useEffect(() => {
    const palco = palcoRef.current;
    if (!palco) return;
    const ouvinte = (ev: WheelEvent) => aoRodar(ev);
    palco.addEventListener("wheel", ouvinte, { passive: false });
    return () => palco.removeEventListener("wheel", ouvinte);
  }, []);

  // Teclado no documento inteiro: as setas funcionam com o foco em qualquer
  // controle, e o Tab dá a volta dentro do visualizador.
  const aoTeclar = useEffectEvent((ev: KeyboardEvent) => {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const dialogo = dialogoRef.current;
    if (!dialogo) return;
    switch (ev.key) {
      case "Escape":
        ev.preventDefault();
        aoFechar();
        return;
      case "ArrowLeft":
        ev.preventDefault();
        navegar(-1);
        return;
      case "ArrowRight":
        ev.preventDefault();
        navegar(1);
        return;
      case "+":
      case "=":
        ev.preventDefault();
        zoomPasso(PASSO_BOTAO);
        return;
      case "-":
      case "_":
        ev.preventDefault();
        zoomPasso(1 / PASSO_BOTAO);
        return;
      case "0":
        ev.preventDefault();
        ajustar(true);
        return;
      case "Tab": {
        const lista = focaveis(dialogo);
        if (!lista.length) return;
        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];
        const ativo = document.activeElement;
        if (!dialogo.contains(ativo)) {
          ev.preventDefault();
          primeiro.focus();
        } else if (ev.shiftKey && ativo === primeiro) {
          ev.preventDefault();
          ultimo.focus();
        } else if (!ev.shiftKey && ativo === ultimo) {
          ev.preventDefault();
          primeiro.focus();
        }
        return;
      }
    }
  });

  useEffect(() => {
    const ouvinte = (ev: KeyboardEvent) => aoTeclar(ev);
    document.addEventListener("keydown", ouvinte);
    return () => document.removeEventListener("keydown", ouvinte);
  }, []);

  // ------------------------------------------------- ponteiro: mouse e dedo

  function pontoDo(ev: EventoPonteiro, c: Caixa): Ponto {
    return { x: ev.clientX - c.ox, y: ev.clientY - c.oy };
  }

  function aoApertar(ev: EventoPonteiro<HTMLDivElement>) {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    const e = estado.current;
    const c = e.caixa;
    if (!c) return;
    e.fecharNoClique = false;
    // Captura: o arraste continua mesmo se o dedo sair do palco.
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /* ponteiro já liberado pelo navegador — segue sem captura */
    }
    const p = pontoDo(ev, c);
    e.ponteiros.set(ev.pointerId, p);
    if (e.ponteiros.size === 1) {
      e.gesto = { tipo: "um", inicio: p, vista0: e.vista, movido: false, depoisDaPinca: false };
    } else if (e.ponteiros.size === 2) {
      const [a, b] = Array.from(e.ponteiros.values());
      e.gesto = { tipo: "pinca", distancia0: distancia(a, b) || 1, meio0: meio(a, b), vista0: e.vista };
      setArrastando(false);
    }
  }

  function aoMover(ev: EventoPonteiro<HTMLDivElement>) {
    const e = estado.current;
    const c = e.caixa;
    const g = e.gesto;
    if (!c || !g || !e.ponteiros.has(ev.pointerId)) return;
    const p = pontoDo(ev, c);
    e.ponteiros.set(ev.pointerId, p);

    if (g.tipo === "pinca") {
      if (e.ponteiros.size < 2) return;
      const [a, b] = Array.from(e.ponteiros.values());
      const v0 = g.vista0;
      const s = limitarEscala((v0.s * distancia(a, b)) / g.distancia0);
      // o ponto da foto que estava entre os dedos acompanha o meio deles
      const lx = (g.meio0.x - c.cx - v0.x) / v0.s;
      const ly = (g.meio0.y - c.cy - v0.y) / v0.s;
      const m = meio(a, b);
      definir(limitar({ s, x: m.x - c.cx - s * lx, y: m.y - c.cy - s * ly }, c), false);
      return;
    }

    const dx = p.x - g.inicio.x;
    const dy = p.y - g.inicio.y;
    if (!g.movido) {
      if (Math.hypot(dx, dy) < LIMIAR_ARRASTE) return;
      g.movido = true;
      if (g.vista0.s > 1.001) setArrastando(true);
    }
    if (g.vista0.s > 1.001) {
      definir(limitar({ s: g.vista0.s, x: g.vista0.x + dx, y: g.vista0.y + dy }, c), false);
    } else if (total > 1 && !g.depoisDaPinca && fotoRef.current) {
      // foto ajustada: o deslize lateral troca de foto, e ela segue o dedo
      e.vista = { s: 1, x: dx, y: 0 };
      pintar(fotoRef.current, e.vista, false);
    }
  }

  function aoSoltar(ev: EventoPonteiro<HTMLDivElement>, cancelado = false) {
    const e = estado.current;
    if (!e.ponteiros.has(ev.pointerId)) return;
    e.ponteiros.delete(ev.pointerId);
    const g = e.gesto;
    const c = e.caixa;

    if (e.ponteiros.size === 1) {
      // terminou a pinça e um dedo ficou: ele passa a arrastar dali
      const [p] = Array.from(e.ponteiros.values());
      e.gesto = { tipo: "um", inicio: p, vista0: e.vista, movido: true, depoisDaPinca: true };
      if (e.vista.s > 1.001) setArrastando(true);
      return;
    }
    if (e.ponteiros.size > 1) return;

    e.gesto = null;
    setArrastando(false);
    if (!g || !c) return;

    if (g.tipo === "pinca" || g.depoisDaPinca) {
      // pinça que mal ampliou assenta de volta na foto ajustada
      if (e.vista.s < 1.05) ajustar(true);
      return;
    }
    if (g.movido) {
      if (g.vista0.s > 1.001) return; // fim de um arraste da foto ampliada
      const p = pontoDo(ev, c);
      const dx = p.x - g.inicio.x;
      const dy = p.y - g.inicio.y;
      if (!cancelado && total > 1 && Math.abs(dx) > LIMIAR_DESLIZE && Math.abs(dx) > Math.abs(dy)) {
        navegar(dx < 0 ? 1 : -1);
      } else {
        ajustar(true);
      }
      return;
    }
    if (!cancelado) tocar(pontoDo(ev, c), ev.timeStamp);
  }

  /**
   * Clique ou toque sem arraste: alterna entre ajustada e ampliada no ponto.
   * O segundo toque de um duplo toque é ignorado — o primeiro já alternou —,
   * senão o duplo toque ampliaria e reduziria na mesma hora. Cada toque
   * ignorado renova a janela: uma rajada de toques rápidos alterna uma vez só.
   */
  function tocar(p: Ponto, t: number) {
    const e = estado.current;
    const c = e.caixa;
    if (!c) return;
    const u = e.ultimoToque;
    e.ultimoToque = { t, x: p.x, y: p.y };
    if (u && t - u.t < JANELA_DUPLO && Math.hypot(p.x - u.x, p.y - u.y) < DISTANCIA_DUPLO) return;
    if (e.vista.s > 1.001) return ajustar(true);
    if (dentroDaFoto(e.vista, c, p)) return definir(zoomNoPonto(e.vista, c, ESCALA_CLIQUE, p.x, p.y), true);
    // Toque no fundo escuro fecha — mas só no `click`, que vem depois do
    // pointerup: fechando antes, o clique "fantasma" cairia na página.
    e.fecharNoClique = true;
  }

  function aoClicar() {
    if (!estado.current.fecharNoClique) return;
    estado.current.fecharNoClique = false;
    aoFechar();
  }

  function aoCarregar(img: HTMLImageElement) {
    const e = estado.current;
    if (img.naturalWidth && img.naturalHeight) e.natural = { w: img.naturalWidth, h: img.naturalHeight };
    reencaixar(e, palcoRef.current, areaRef.current, fotoRef.current);
    if (fotoRef.current) fotoRef.current.style.opacity = "1";
  }

  const cursorPalco = arrastando ? "cursor-grabbing" : ampliada ? "cursor-grab" : "cursor-default";
  const varias = total > 1;

  return (
    <dialog
      ref={dialogoRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos ampliadas: ${titulo}`}
      // Esc pelo próprio <dialog>: fecha pelo estado do React, não sozinho.
      onCancel={(ev) => {
        ev.preventDefault();
        aoFechar();
      }}
      // Fechou por fora (o navegador pode forçar); ignora o close() da
      // limpeza do efeito, que dispara este evento com o diálogo reaberto.
      onClose={() => {
        if (!dialogoRef.current?.open) aoFechar();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none touch-manipulation select-none overflow-hidden overscroll-contain border-0 bg-carvao-950/95 p-0 text-white transition-opacity duration-200 backdrop:bg-black/40 starting:opacity-0"
    >
      <div
        ref={palcoRef}
        className={`absolute inset-0 touch-none ${cursorPalco}`}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={(ev) => aoSoltar(ev)}
        onPointerCancel={(ev) => aoSoltar(ev, true)}
        onClick={aoClicar}
        onDragStart={(ev) => ev.preventDefault()}
      >
        {/* área útil: onde a foto fica ajustada, fora das barras e das setas.
            Em tela baixa (celular deitado) a barra de baixo some e a foto
            ganha a altura. */}
        <div
          ref={areaRef}
          aria-hidden="true"
          className={`pointer-events-none invisible absolute inset-x-3 top-16 sm:inset-x-20 [@media(max-height:500px)]:bottom-3! ${
            varias ? "bottom-36 sm:bottom-32" : "bottom-14"
          }`}
        />
        <div
          key={foto.id}
          ref={fotoRef}
          className={`absolute left-0 top-0 origin-center overflow-hidden rounded-md bg-white opacity-0 shadow-2xl will-change-transform [-webkit-touch-callout:none] ${
            ampliada ? "" : "cursor-zoom-in"
          }`}
        >
          <Image
            src={foto.url}
            alt={foto.alt ?? titulo}
            fill
            sizes="100vw"
            loading="eager"
            draggable={false}
            onLoad={(ev) => aoCarregar(ev.currentTarget)}
            onError={() => {
              if (fotoRef.current) fotoRef.current.style.opacity = "1";
            }}
            className="object-contain"
          />
        </div>
      </div>

      {/* barra de cima: contador, zoom e fechar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-14 items-center gap-3 bg-linear-to-b from-black/60 to-transparent px-3 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-sm [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]">
          {varias && (
            <span aria-live="polite" aria-atomic="true" className="font-semibold tabular-nums">
              {indice + 1} de {total}
            </span>
          )}
          <span className="hidden text-white/70 sm:inline">
            {varias ? " · " : ""}
            {titulo}
          </span>
        </p>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <BotaoIcone rotulo="Diminuir zoom" inativo={!ampliada} onClick={() => zoomPasso(1 / PASSO_BOTAO)} className="flex">
            <path d="M6 12h12" />
          </BotaoIcone>
          <BotaoIcone rotulo="Aumentar zoom" inativo={noMaximo} onClick={() => zoomPasso(PASSO_BOTAO)} className="flex">
            <path d="M6 12h12M12 6v12" />
          </BotaoIcone>
          <BotaoIcone ref={fecharRef} rotulo="Fechar" onClick={aoFechar} className="ml-1 flex">
            <path d="m6 6 12 12M18 6 6 18" />
          </BotaoIcone>
        </div>
      </div>

      {/* setas laterais (do tablet para cima; no celular elas vão para baixo) */}
      {varias && (
        <>
          <BotaoIcone
            rotulo="Foto anterior"
            onClick={() => navegar(-1)}
            className="absolute left-4 top-1/2 hidden h-12! w-12! -translate-y-1/2 sm:flex"
          >
            <path d="m14.5 6-6 6 6 6" />
          </BotaoIcone>
          <BotaoIcone
            rotulo="Próxima foto"
            onClick={() => navegar(1)}
            className="absolute right-4 top-1/2 hidden h-12! w-12! -translate-y-1/2 sm:flex"
          >
            <path d="m9.5 6 6 6-6 6" />
          </BotaoIcone>
        </>
      )}

      {/* barra de baixo: dica de uso e miniaturas */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 [@media(max-height:500px)]:hidden! bg-linear-to-t from-black/60 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
        {/* pílula escura: a dica continua legível com a foto branca por baixo */}
        <p className="rounded-full bg-black/45 px-3 py-1 text-center text-xs text-white/85">
          <span className="pointer-coarse:hidden">
            {ampliada
              ? "Arraste para mover · clique para voltar ao tamanho da tela"
              : "Clique na foto para ampliar · a roda do mouse ajusta o zoom"}
          </span>
          <span className="hidden pointer-coarse:inline">
            {ampliada
              ? "Arraste para mover · toque para voltar"
              : varias
                ? "Toque na foto para ampliar · deslize para trocar"
                : "Toque na foto ou use dois dedos para ampliar"}
          </span>
        </p>

        {varias && (
          <div className="pointer-events-auto flex w-full items-center justify-center gap-2">
            <BotaoIcone rotulo="Foto anterior" onClick={() => navegar(-1)} className="flex shrink-0 sm:hidden">
              <path d="m14.5 6-6 6 6 6" />
            </BotaoIcone>
            <div ref={faixaRef} className="rolagem-fina flex min-w-0 touch-pan-x gap-1.5 overflow-x-auto p-1 sm:gap-2">
              {fotos.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`Ver foto ${i + 1} de ${total}`}
                  aria-current={i === indice ? "true" : undefined}
                  onClick={() => aoTrocar(i)}
                  className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-white ring-2 transition sm:h-14 sm:w-14 ${
                    i === indice ? "ring-white" : "opacity-55 ring-transparent hover:opacity-90"
                  }`}
                >
                  <Image src={f.url} alt="" fill sizes="56px" draggable={false} className="object-contain p-0.5" />
                </button>
              ))}
            </div>
            <BotaoIcone rotulo="Próxima foto" onClick={() => navegar(1)} className="flex shrink-0 sm:hidden">
              <path d="m9.5 6 6 6-6 6" />
            </BotaoIcone>
          </div>
        )}
      </div>
    </dialog>
  );
}

/**
 * Botão redondo só com ícone, sobre o fundo escuro. "Inativo" usa
 * aria-disabled em vez de disabled: um botão que se desabilita com o foco
 * nele (zoom chegou no máximo) jogaria o foco para fora do diálogo.
 */
function BotaoIcone({
  rotulo,
  onClick,
  inativo = false,
  className = "",
  children,
  ref,
}: {
  rotulo: string;
  onClick: () => void;
  inativo?: boolean;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={rotulo}
      title={rotulo}
      aria-disabled={inativo || undefined}
      onClick={inativo ? undefined : onClick}
      // fundo escuro, não branco translúcido: com a foto ampliada passando por
      // baixo (fundo branco), um botão claro sumiria
      className={`h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 transition hover:bg-black/75 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-black/50 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

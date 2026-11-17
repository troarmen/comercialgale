"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Arara 3D do topo da home (pedido do cliente, nov/2026): três peças
 * penduradas num cabide que o visitante gira com o dedo ou o mouse, de 0 a
 * 360 graus.
 *
 * Sem WebGL e sem biblioteca: é CSS 3D. Cada peça é um recorte com fundo
 * transparente (public/arara/, gerado por scripts/recortar_arara.py) empilhado
 * em algumas camadas finas — de frente se vê a foto; de lado, a espessura
 * escura das camadas do meio; de costas, a mesma silhueta espelhada e um
 * pouco mais escura, como o avesso da peça. O catálogo só tem foto de frente,
 * então as costas são essa aproximação, não uma foto real.
 *
 * Movimento: um único laço de requestAnimationFrame para as três peças, que
 * só roda enquanto alguma coisa se mexe e para sozinho quando tudo assenta.
 * Soltou a peça, ela segue no embalo, desacelera e, passado um tempo,
 * volta de frente. Com "reduzir movimento" no sistema, nada se mexe sozinho
 * (nem a volta de apresentação nem o balanço do mouse); girar com a mão
 * continua funcionando.
 */

export type PecaArara = {
  href: string;
  /** nome lido pelo leitor de tela: "Camisola Feminina 02 — Desafio" */
  nome: string;
  /** texto da etiqueta pendurada: marca e referência */
  etiqueta: string;
  recorte: string;
  largura: number;
  altura: number;
  /** largura da peça dentro da vaga, em % — dá a escala relativa entre elas */
  escala: number;
  /** "alca": a peça pende pelas alças; "presilha": presa por dois prendedores */
  cabide: "alca" | "presilha";
};

type Estado = {
  giro: number; // graus
  vel: number; // graus/s
  balanco: number; // graus, pêndulo no gancho
  velBal: number;
  arrastando: boolean;
  soltouEm: number;
  tween: { de: number; para: number; t0: number; dur: number } | null;
};

const CAMADAS = 6;
const PASSO_Z = 1.2; // px entre camadas: a peça fica com ~6px de espessura
const PAUSA_ANTES_DE_VOLTAR = 2600; // ms parado de costas antes de voltar de frente

const novoEstado = (): Estado => ({
  giro: 0,
  vel: 0,
  balanco: 0,
  velBal: 0,
  arrastando: false,
  soltouEm: -Infinity,
  tween: null,
});

const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Arara3D({ pecas }: { pecas: PecaArara[] }) {
  const raiz = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLElement | null)[]>([]);
  const estados = useRef<Estado[]>(pecas.map(novoEstado));
  const raf = useRef(0);
  const ultimo = useRef(0);
  const arrasto = useRef<{ i: number; x: number; giro0: number; moveu: boolean; t: number; g: number } | null>(null);
  const bloquearClique = useRef(false);
  const parado = useRef(false); // prefers-reduced-motion

  // ----------------------------------------------------------------- laço
  const aplicar = (i: number) => {
    const el = els.current[i];
    const e = estados.current[i];
    if (!el) return;
    const rad = (e.giro * Math.PI) / 180;
    const cos = Math.cos(rad);
    el.style.setProperty("--giro", `${e.giro.toFixed(2)}deg`);
    el.style.setProperty("--balanco", `${e.balanco.toFixed(2)}deg`);
    // luz: a faixa de brilho atravessa a peça uma vez por volta e fica fora
    // dela quando a peça está parada de frente; a sombra cresce de lado
    const volta = (((e.giro % 360) + 360) % 360) / 360;
    el.style.setProperty("--luz", `${(volta * 100).toFixed(1)}%`);
    el.style.setProperty("--escuro", (1 - Math.abs(cos)).toFixed(3));
    el.style.setProperty("--chao", (0.4 + 0.6 * Math.abs(cos)).toFixed(3));
  };

  const passo = (t: number) => {
    const dt = Math.min(0.05, (t - (ultimo.current || t)) / 1000);
    ultimo.current = t;
    let ativo = false;

    estados.current.forEach((e, i) => {
      if (e.tween) {
        const k = Math.min(1, (t - e.tween.t0) / e.tween.dur);
        e.giro = e.tween.de + (e.tween.para - e.tween.de) * suave(k);
        if (k >= 1) {
          e.tween = null;
          e.giro = ((e.giro % 360) + 360) % 360;
          if (e.giro > 359.5 || e.giro < 0.5) e.giro = 0;
          e.vel = 0;
          e.soltouEm = t;
        }
        ativo = true;
      } else if (!e.arrastando) {
        // embalo depois de soltar
        e.giro += e.vel * dt;
        e.vel *= Math.pow(0.12, dt);
        if (t - e.soltouEm > PAUSA_ANTES_DE_VOLTAR) {
          // mola de volta para a frente (o múltiplo de 360 mais perto)
          const alvo = Math.round(e.giro / 360) * 360;
          e.vel += (-16 * (e.giro - alvo) - 7.5 * e.vel) * dt;
          if (Math.abs(e.giro - alvo) < 0.2 && Math.abs(e.vel) < 2) {
            e.giro = 0;
            e.vel = 0;
          } else ativo = true;
        } else if (e.giro % 360 !== 0) {
          ativo = true;
        }
      } else {
        ativo = true;
      }

      // pêndulo no gancho: acompanha o embalo do giro e volta ao prumo
      const alvoBal = e.arrastando || e.tween ? limitar(-e.vel * 0.01, -4, 4) : 0;
      e.velBal += (-28 * (e.balanco - alvoBal) - 3.4 * e.velBal) * dt;
      e.balanco += e.velBal * dt;
      if (Math.abs(e.balanco) > 0.03 || Math.abs(e.velBal) > 0.08) ativo = true;
      else if (!e.arrastando) {
        e.balanco = 0;
        e.velBal = 0;
      }

      aplicar(i);
    });

    raf.current = ativo ? requestAnimationFrame(passo) : 0;
  };

  const acordar = () => {
    if (!raf.current) {
      ultimo.current = 0;
      raf.current = requestAnimationFrame(passo);
    }
  };

  useEffect(() => {
    parado.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    estados.current.forEach((_, i) => aplicar(i));

    // Volta de apresentação: quando a arara aparece na tela, a peça do meio
    // dá um giro completo — é o que conta ao visitante que dá para girar.
    let timer = 0;
    const alvo = raiz.current;
    const io =
      !parado.current && alvo
        ? new IntersectionObserver(
            ([entrada]) => {
              if (!entrada.isIntersecting) return;
              io?.disconnect();
              timer = window.setTimeout(() => {
                const meio = Math.floor(estados.current.length / 2);
                const e = estados.current[meio];
                if (!e || e.arrastando || arrasto.current) return;
                e.tween = { de: 0, para: 360, t0: performance.now(), dur: 2600 };
                estados.current.forEach((o, j) => j !== meio && (o.velBal += j < meio ? -10 : 10));
                acordar();
              }, 900);
            },
            { threshold: 0.6 },
          )
        : null;
    if (io && alvo) io.observe(alvo);

    return () => {
      io?.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------- gestos
  const aoApertar = (i: number) => (ev: React.PointerEvent<HTMLAnchorElement>) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    const e = estados.current[i];
    e.tween = null;
    e.arrastando = true;
    e.vel = 0;
    arrasto.current = { i, x: ev.clientX, giro0: e.giro, moveu: false, t: performance.now(), g: e.giro };
    bloquearClique.current = false;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    acordar();
  };

  const aoMover = (i: number) => (ev: React.PointerEvent<HTMLAnchorElement>) => {
    const a = arrasto.current;
    if (!a || a.i !== i) return;
    const dx = ev.clientX - a.x;
    if (!a.moveu && Math.abs(dx) > 5) a.moveu = true;
    if (!a.moveu) return;
    const e = estados.current[i];
    // 1px de arrasto = 0,8°: atravessar a peça inteira dá meia volta
    e.giro = a.giro0 + dx * 0.8;
    const agora = performance.now();
    const dt = (agora - a.t) / 1000;
    if (dt > 0.008) {
      e.vel = e.vel * 0.4 + ((e.giro - a.g) / dt) * 0.6;
      a.t = agora;
      a.g = e.giro;
    }
  };

  const aoSoltar = (i: number) => (ev: React.PointerEvent<HTMLAnchorElement>) => {
    const a = arrasto.current;
    if (!a || a.i !== i) return;
    const e = estados.current[i];
    e.arrastando = false;
    e.soltouEm = performance.now();
    // parou o dedo antes de soltar: sem embalo
    if (performance.now() - a.t > 90) e.vel = 0;
    e.vel = limitar(e.vel, -900, 900);
    bloquearClique.current = a.moveu;
    arrasto.current = null;
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
    acordar();
  };

  const aoEntrar = (i: number) => (ev: React.PointerEvent<HTMLAnchorElement>) => {
    if (ev.pointerType !== "mouse" || parado.current || arrasto.current) return;
    estados.current[i].velBal += 12;
    acordar();
  };

  const aoTeclar = (i: number) => (ev: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    ev.preventDefault();
    const e = estados.current[i];
    const de = e.tween ? e.tween.para : e.giro;
    e.tween = {
      de: e.giro,
      para: de + (ev.key === "ArrowRight" ? 45 : -45),
      t0: performance.now(),
      dur: parado.current ? 1 : 380,
    };
    acordar();
  };

  return (
    <div ref={raiz} className="arara">
      {/* gradiente do cromo definido uma vez só, usado pelos três ganchos */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="arara-cromo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8d8f96" />
            <stop offset="0.45" stopColor="#f4f5f7" />
            <stop offset="1" stopColor="#7a7c83" />
          </linearGradient>
        </defs>
      </svg>
      <span className="arara-trilho" aria-hidden="true" />
      <ul className="arara-vagas">
        {pecas.map((p, i) => {
          const meio = ((CAMADAS - 1) * PASSO_Z) / 2;
          return (
            <li key={p.href} className="arara-vaga">
              <Link
                href={p.href}
                aria-label={`${p.nome}. Arraste ou use as setas para girar.`}
                draggable={false}
                ref={(el) => {
                  els.current[i] = el;
                }}
                className="arara-peca"
                style={{ "--larg": `${p.escala}%` } as React.CSSProperties}
                onPointerDown={aoApertar(i)}
                onPointerMove={aoMover(i)}
                onPointerUp={aoSoltar(i)}
                onPointerCancel={aoSoltar(i)}
                onPointerEnter={aoEntrar(i)}
                onKeyDown={aoTeclar(i)}
                onDragStart={(ev) => ev.preventDefault()}
                onClick={(ev) => {
                  if (bloquearClique.current) {
                    ev.preventDefault();
                    bloquearClique.current = false;
                  }
                }}
              >
                <span className="arara-balanco">
                  <span className={`arara-giro arara-giro-${p.cabide}`}>
                    <Gancho />
                    <span
                      className={`arara-cabide arara-cabide-${p.cabide}`}
                      aria-hidden="true"
                    />
                    <span className="arara-camadas" style={{ aspectRatio: `${p.largura} / ${p.altura}` }}>
                      {Array.from({ length: CAMADAS }, (_, c) => {
                        const z = c * PASSO_Z - meio;
                        const papel = c === CAMADAS - 1 ? "frente" : c === 0 ? "costas" : "miolo";
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={c}
                            src={p.recorte}
                            alt=""
                            width={p.largura}
                            height={p.altura}
                            draggable={false}
                            decoding="async"
                            fetchPriority={c === CAMADAS - 1 && i === 1 ? "high" : undefined}
                            className={`arara-camada arara-${papel}`}
                            style={{ transform: `translateZ(${z.toFixed(2)}px)` }}
                          />
                        );
                      })}
                      {/* luz e sombra recortadas no formato da peça */}
                      <span
                        className="arara-luz"
                        style={{
                          transform: `translateZ(${(meio + 0.3).toFixed(2)}px)`,
                          WebkitMaskImage: `url(${p.recorte})`,
                          maskImage: `url(${p.recorte})`,
                        }}
                      />
                      <span
                        className="arara-luz arara-luz-costas"
                        style={{
                          transform: `translateZ(${(-meio - 0.3).toFixed(2)}px) rotateY(180deg) scaleX(-1)`,
                          WebkitMaskImage: `url(${p.recorte})`,
                          maskImage: `url(${p.recorte})`,
                        }}
                      />
                    </span>
                    <span
                      className="arara-etiqueta"
                      style={{ transform: `translateZ(${(meio + 1).toFixed(2)}px)` }}
                    >
                      {p.etiqueta}
                    </span>
                  </span>
                </span>
                <span className="arara-chao" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="arara-dica">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M3.5 10a6.5 6.5 0 0 1 11.6-4M16.5 10a6.5 6.5 0 0 1-11.6 4M15.5 2.5v3.6h-3.6M4.5 17.5v-3.6h3.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="arara-dica-mouse">Arraste uma peça para girar 360°</span>
        <span className="arara-dica-toque">Deslize uma peça para girar 360°</span>
      </p>
    </div>
  );
}

/** Gancho cromado do cabide: sobe do centro da peça e abraça o trilho. */
function Gancho() {
  return (
    <svg className="arara-gancho" viewBox="0 0 28 48" fill="none" aria-hidden="true">
      <path
        d="M14 47V30c0-3.5-2.6-5.5-6.2-7.2C4.6 21.2 3 18.8 3 15.5 3 10.2 7.6 6 13.5 6 19.4 6 24 10 24 15"
        stroke="url(#arara-cromo)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

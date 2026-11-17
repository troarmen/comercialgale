"use client";

import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { BannerLoja } from "@/lib/vitrine";

/**
 * Topo da home: o texto (h1, chamada e botões) por cima dos banners do painel
 * (Vitrine), que passam em carrossel. Decisão do cliente em nov/2026: o topo
 * vira banner para a equipe trocar por produto e por estação, sem depender de
 * nós — mas o h1 continua TEXTO no HTML, nunca dentro da arte. Por isso o
 * texto chega pronto do servidor como `children` e o componente só cuida das
 * imagens em volta dele.
 *
 * Três arranjos, pela largura:
 *   • até 1023px: texto e, embaixo, o banner num quadro quadrado (a imagem de
 *     celular do painel; sem ela, o lado direito da arte de computador, onde
 *     o painel pede para pôr os produtos);
 *   • 1024–1279px: texto à esquerda, o mesmo quadro quadrado à direita;
 *   • 1280px ou mais: o banner de computador (3:1) vira o FUNDO do topo
 *     inteiro, com o texto por cima da metade esquerda. Um véu rosado à
 *     esquerda garante a leitura do h1 mesmo se a arte enviada não deixar
 *     aquele lado livre.
 *
 * A troca é por esmaecimento (o fundo atrás de um texto parado não pode
 * deslizar) e segue o padrão de carrossel do WAI-ARIA: passa sozinho a cada
 * 6 s; para com o mouse em cima, com o foco do teclado dentro, com a aba
 * escondida e, sempre, com `prefers-reduced-motion` (aí só troca quando a
 * pessoa pede); tem botão de pausar, setas, pontinhos e deslizar com o dedo;
 * os banners fora de vista ficam `inert`.
 */

const INTERVALO = 6000;

function assinarMovimento(avisar: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}
const querMenosMovimento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function assinarVisibilidade(avisar: () => void) {
  document.addEventListener("visibilitychange", avisar);
  return () => document.removeEventListener("visibilitychange", avisar);
}
const abaOculta = () => document.visibilityState === "hidden";

// ------------------------------------------------------------------ slide

function ImagemBanner({
  banner,
  prioridade,
  carregar,
}: {
  banner: BannerLoja;
  prioridade: boolean;
  carregar: boolean;
}) {
  const base = banner.celular ?? banner.computador;
  // Sem imagem de celular, o quadro quadrado mostra o lado direito da arte
  // de computador — onde o painel pede para os produtos ficarem.
  const enquadre = banner.celular ? "object-center" : "object-[88%_50%]";
  return (
    <picture>
      <source
        media="(min-width: 1280px)"
        srcSet={banner.computador.src}
        width={banner.computador.largura}
        height={banner.computador.altura}
      />
      <img
        src={base.src}
        width={base.largura}
        height={base.altura}
        alt={banner.alt}
        loading={prioridade || carregar ? "eager" : "lazy"}
        fetchPriority={prioridade ? "high" : "low"}
        decoding="async"
        draggable={false}
        className={`absolute inset-0 h-full w-full object-cover ${enquadre} xl:object-[100%_50%]`}
      />
    </picture>
  );
}

function Slide({
  banner,
  prioridade,
  carregar,
}: {
  banner: BannerLoja;
  prioridade: boolean;
  carregar: boolean;
}) {
  const imagem = <ImagemBanner banner={banner} prioridade={prioridade} carregar={carregar} />;
  // O anel de foco vai POR DENTRO: a moldura corta o que passa da borda.
  const foco =
    "absolute inset-0 block outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-gale-500";
  if (!banner.link) return <div className="absolute inset-0">{imagem}</div>;
  if (banner.link.externo) {
    return (
      <a href={banner.link.href} target="_blank" rel="noopener noreferrer" className={foco}>
        {imagem}
        <span className="sr-only"> (abre em uma nova aba)</span>
      </a>
    );
  }
  return (
    <Link href={banner.link.href} className={foco}>
      {imagem}
    </Link>
  );
}

// ------------------------------------------------------------------- topo

type Toque = { x: number; y: number; id: number; horizontal: boolean | null };

export function TopoBanners({
  banners,
  children,
}: {
  banners: BannerLoja[];
  children: React.ReactNode;
}) {
  const n = banners.length;
  const idSlides = useId();

  const [atual, setAtual] = useState(0);
  const [mouseSobre, setMouseSobre] = useState(false);
  const [focoTeclado, setFocoTeclado] = useState(false);
  const [escolha, setEscolha] = useState<"auto" | "pausado" | "tocando">("auto");
  const [carregarTodos, setCarregarTodos] = useState(false);

  // No servidor não há preferência a ler: renderiza parado e o navegador
  // decide na hidratação.
  const reduzido = useSyncExternalStore(assinarMovimento, querMenosMovimento, () => true);
  const oculta = useSyncExternalStore(assinarVisibilidade, abaOculta, () => false);

  const toque = useRef<Toque | null>(null);
  const arrastou = useRef(false);

  const varios = n > 1;
  const automatico = escolha === "tocando" || (escolha === "auto" && !reduzido);
  const girando = varios && automatico && !mouseSobre && !focoTeclado && !oculta;

  const irPara = (i: number) => setAtual(((i % n) + n) % n);
  const proximo = () => irPara(atual + 1);
  const anterior = () => irPara(atual - 1);

  // Troca automática. Recomeça a contagem a cada mudança — inclusive as
  // pedidas pela pessoa, que ganha os 6 s inteiros no banner que escolheu.
  const avancar = useEffectEvent(() => irPara(atual + 1));
  useEffect(() => {
    if (!girando) return;
    const id = setTimeout(avancar, INTERVALO);
    return () => clearTimeout(id);
  }, [girando, atual]);

  // As outras imagens começam a baixar só depois que a página carregou, para
  // não disputar banda com a primeira (que é o maior elemento da tela).
  useEffect(() => {
    if (!varios) return;
    const liberar = () => setCarregarTodos(true);
    if (document.readyState === "complete") {
      const id = setTimeout(liberar, 200);
      return () => clearTimeout(id);
    }
    window.addEventListener("load", liberar, { once: true });
    return () => window.removeEventListener("load", liberar);
  }, [varios]);

  // ---------------------------------------------------------- dedo
  // Só toque e caneta: arrastar com o mouse brigaria com o clique no link.
  function aoTocar(e: React.PointerEvent<HTMLDivElement>) {
    arrastou.current = false;
    if (!varios || e.pointerType === "mouse") return;
    toque.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  }
  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    const t = toque.current;
    if (!t || t.id !== e.pointerId) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (t.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      t.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!t.horizontal) toque.current = null;
      else arrastou.current = true;
    }
  }
  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    const t = toque.current;
    toque.current = null;
    if (!t?.horizontal) return;
    const dx = e.clientX - t.x;
    if (dx <= -40) proximo();
    else if (dx >= 40) anterior();
  }

  const botao =
    "flex h-8 w-8 items-center justify-center rounded-full text-texto transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gale-500";

  return (
    <section className="fundo-hero relative overflow-hidden border-b border-borda">
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pb-6 pt-8 lg:grid-cols-[1fr_0.85fr] lg:gap-10 lg:py-12 xl:flex xl:min-h-[500px]">
        {/* o texto fica ACIMA da arte no arranjo de fundo (xl) */}
        <div className="relative z-10 xl:max-w-xl">{children}</div>

        {n > 0 && (
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Banners da Galé"
            className="topo-banners relative isolate mx-auto aspect-square w-full max-w-lg overflow-hidden rounded-2xl bg-superficie shadow-suave ring-1 ring-borda lg:max-w-none xl:absolute xl:inset-0 xl:aspect-auto xl:rounded-none xl:bg-transparent xl:shadow-none xl:ring-0"
            onPointerEnter={(e) => e.pointerType === "mouse" && setMouseSobre(true)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setMouseSobre(false)}
            onFocus={(e) => {
              // Só foco de TECLADO pausa: clicar numa seta com o mouse não
              // deve deixar o carrossel parado até clicar em outro lugar.
              if (e.target.matches(":focus-visible")) setFocoTeclado(true);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocoTeclado(false);
            }}
          >
            <div
              id={idSlides}
              aria-live={girando ? "off" : "polite"}
              className="topo-banners-faixa absolute inset-0 touch-pan-y select-none"
              onPointerDown={aoTocar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={() => (toque.current = null)}
              onClickCapture={(e) => {
                // Fim de um deslize não é clique no link do banner.
                if (arrastou.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  arrastou.current = false;
                }
              }}
            >
              {banners.map((b, i) => {
                const visivel = i === atual;
                return (
                  <div
                    key={b.id}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} de ${n}`}
                    aria-hidden={!visivel || undefined}
                    inert={!visivel}
                    className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                      visivel ? "z-[1] opacity-100" : "opacity-0"
                    }`}
                  >
                    <Slide banner={b} prioridade={i === 0} carregar={carregarTodos} />
                  </div>
                );
              })}
            </div>

            {/* véu de leitura do h1 — só no arranjo de fundo */}
            <span aria-hidden="true" className="topo-banners-veu pointer-events-none absolute inset-0 z-[2] hidden xl:block" />

            {varios && (
              <div className="absolute bottom-3 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/90 px-1 py-0.5 shadow-flutuante ring-1 ring-black/5 backdrop-blur-sm xl:bottom-5 xl:left-auto xl:right-[max(1rem,calc(50%-624px))] xl:translate-x-0">
                <button
                  type="button"
                  onClick={anterior}
                  aria-controls={idSlides}
                  aria-label="Banner anterior"
                  className={botao}
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path d="m12.5 4.5-5.5 5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => irPara(i)}
                    aria-controls={idSlides}
                    aria-label={`Mostrar o banner ${i + 1} de ${n}`}
                    aria-current={i === atual ? "true" : undefined}
                    className="group flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-gale-500"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all ${
                        i === atual ? "w-5 bg-acento" : "w-2 bg-texto/25 group-hover:bg-texto/45"
                      }`}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEscolha(automatico ? "pausado" : "tocando")}
                  aria-label={
                    automatico
                      ? "Pausar a troca automática dos banners"
                      : "Ligar a troca automática dos banners"
                  }
                  className={botao}
                >
                  {automatico ? (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                      <rect x="3.5" y="3" width="3" height="10" rx="0.8" />
                      <rect x="9.5" y="3" width="3" height="10" rx="0.8" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                      <path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={proximo}
                  aria-controls={idSlides}
                  aria-label="Próximo banner"
                  className={botao}
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

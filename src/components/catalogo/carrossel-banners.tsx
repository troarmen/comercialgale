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
 * Banners do topo da home, cadastrados no painel (Vitrine). Feito à mão — a
 * casa não leva dependência para isso — seguindo o padrão de carrossel do
 * WAI-ARIA (APG):
 *
 *   • troca sozinho a cada 6 s e dá a volta (o último leva ao primeiro);
 *   • PARA quando o mouse está em cima, quando o foco do TECLADO entra nele,
 *     quando a aba está escondida e, sempre, com `prefers-reduced-motion`
 *     (aí só troca quando a pessoa pede); há ainda o botão de pausar;
 *   • setas, pontinhos e deslizar com o dedo no celular;
 *   • os slides fora de vista ficam `inert`: o Tab não cai num link que não
 *     se vê.
 *
 * O LOOP sem "rebobinar": a faixa tem uma cópia do último banner no começo e
 * do primeiro no fim. Ao chegar numa cópia, depois da animação, pulamos sem
 * transição para o banner verdadeiro igual — o olho não percebe o salto.
 *
 * A MOLDURA tem proporção fixa (3:1 no computador; quadrada no celular quando
 * algum banner tem imagem de celular), então nada pula quando a imagem chega.
 * A imagem do celular entra por <picture>: o navegador baixa só a da tela em
 * uso. A primeira imagem vem com prioridade; as outras esperam a página
 * terminar de carregar para não disputar banda com ela.
 */

const INTERVALO = 6000;
const DURACAO = 550; // ms — igual ao `duration-[550ms]` da faixa

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

function moldura(quadradoNoCelular: boolean) {
  return quadradoNoCelular ? "aspect-square md:aspect-[3/1]" : "aspect-[3/1]";
}

const CAIXA =
  "relative overflow-hidden rounded-2xl bg-white shadow-suave ring-1 ring-borda";

// ----------------------------------------------------------------- banner

function ConteudoBanner({
  banner,
  quadradoNoCelular,
  prioridade,
  carregar,
}: {
  banner: BannerLoja;
  quadradoNoCelular: boolean;
  prioridade: boolean;
  carregar: boolean;
}) {
  const base = banner.celular ?? banner.computador;
  // Moldura quadrada no celular e banner SEM imagem de celular: mostra a
  // arte inteira com faixas brancas, em vez de cortar dois terços dela.
  const encaixe =
    quadradoNoCelular && !banner.celular ? "object-contain md:object-cover" : "object-cover";

  const imagem = (
    <picture>
      {banner.celular && (
        <source
          media="(min-width: 768px)"
          srcSet={banner.computador.src}
          width={banner.computador.largura}
          height={banner.computador.altura}
        />
      )}
      <img
        src={base.src}
        width={base.largura}
        height={base.altura}
        alt={banner.alt}
        loading={prioridade || carregar ? "eager" : "lazy"}
        fetchPriority={prioridade ? "high" : "low"}
        decoding="async"
        draggable={false}
        className={`absolute inset-0 h-full w-full ${encaixe}`}
      />
    </picture>
  );

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

// -------------------------------------------------------------- carrossel

export function CarrosselBanners({ banners }: { banners: BannerLoja[] }) {
  const quadradoNoCelular = banners.some((b) => b.celular);
  if (!banners.length) return null;

  // Um banner só: sem setas, sem pontinhos, sem troca — é só uma imagem.
  if (banners.length === 1) {
    return (
      <div className={`${CAIXA} ${moldura(quadradoNoCelular)}`}>
        <ConteudoBanner
          banner={banners[0]}
          quadradoNoCelular={quadradoNoCelular}
          prioridade
          carregar
        />
      </div>
    );
  }
  return <Carrossel banners={banners} quadradoNoCelular={quadradoNoCelular} />;
}

type Toque = { x: number; y: number; id: number; horizontal: boolean | null };

function Carrossel({
  banners,
  quadradoNoCelular,
}: {
  banners: BannerLoja[];
  quadradoNoCelular: boolean;
}) {
  const n = banners.length;
  const idSlides = useId();

  // Posição na FAIXA: 0 é a cópia do último, 1..n os banners, n+1 a cópia do
  // primeiro.
  const [posicao, setPosicao] = useState(1);
  const [animar, setAnimar] = useState(true);
  const [arrasto, setArrasto] = useState(0);
  const [mouseSobre, setMouseSobre] = useState(false);
  const [focoTeclado, setFocoTeclado] = useState(false);
  const [escolha, setEscolha] = useState<"auto" | "pausado" | "tocando">("auto");
  const [carregarTodos, setCarregarTodos] = useState(false);

  // No servidor não há preferência a ler: renderiza parado e o navegador
  // decide na hidratação.
  const reduzido = useSyncExternalStore(assinarMovimento, querMenosMovimento, () => true);
  const oculta = useSyncExternalStore(assinarVisibilidade, abaOculta, () => false);

  const emTransicao = useRef(false);
  const toque = useRef<Toque | null>(null);
  const arrastou = useRef(false);

  const atual = (posicao - 1 + n) % n;
  const automatico = escolha === "tocando" || (escolha === "auto" && !reduzido);
  const girando = automatico && !mouseSobre && !focoTeclado && !oculta && arrasto === 0;
  const comTransicao = animar && !reduzido && arrasto === 0;

  function irPara(destino: number) {
    // Destino = posição atual (pontinho do banner que já está à mostra): o
    // React não renderiza de novo, não há animação nem `transitionend`, e a
    // trava `emTransicao` nunca seria solta — o carrossel congelaria.
    if (emTransicao.current || destino === posicao) return;
    if (reduzido) {
      // Sem animação não há cópia a atravessar: vai direto ao verdadeiro.
      setAnimar(false);
      setPosicao(((destino - 1 + n) % n) + 1);
      return;
    }
    emTransicao.current = true;
    setAnimar(true);
    setPosicao(destino);
  }
  const proximo = () => irPara(posicao + 1);
  const anterior = () => irPara(posicao - 1);

  // Fim da animação: se parou numa cópia, salta sem transição para o banner
  // verdadeiro igual a ela.
  function terminar() {
    emTransicao.current = false;
    if (posicao === n + 1 || posicao === 0) {
      setAnimar(false);
      setPosicao(posicao === 0 ? n : 1);
    }
  }

  // Rede de segurança: `transitionend` não dispara se a aba some no meio da
  // animação (o navegador congela) — o tempo garante que a faixa destrava.
  const terminarPeloTempo = useEffectEvent(terminar);
  useEffect(() => {
    const id = setTimeout(terminarPeloTempo, DURACAO + 100);
    return () => clearTimeout(id);
  }, [posicao]);

  // Depois do salto sem transição, religa a animação no quadro seguinte ao
  // que já pintou a posição nova (dois rAF: um agenda, o outro confirma).
  useEffect(() => {
    if (animar) return;
    let segundo = 0;
    const primeiro = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(() => setAnimar(true));
    });
    return () => {
      cancelAnimationFrame(primeiro);
      cancelAnimationFrame(segundo);
    };
  }, [animar]);

  // Troca automática. Recomeça a contagem a cada mudança de banner — inclusive
  // as pedidas pela pessoa, que ganha os 6 s inteiros no banner que escolheu.
  const avancar = useEffectEvent(() => irPara(posicao + 1));
  useEffect(() => {
    if (!girando) return;
    const id = setTimeout(avancar, INTERVALO);
    return () => clearTimeout(id);
  }, [girando, posicao]);

  // As outras imagens começam a baixar só depois que a página carregou.
  useEffect(() => {
    const liberar = () => setCarregarTodos(true);
    if (document.readyState === "complete") {
      const id = setTimeout(liberar, 200);
      return () => clearTimeout(id);
    }
    window.addEventListener("load", liberar, { once: true });
    return () => window.removeEventListener("load", liberar);
  }, []);

  // ---------------------------------------------------------- dedo
  // Só toque e caneta: arrastar com o mouse brigaria com o clique no link.
  // `touch-pan-y` deixa a rolagem vertical com o navegador e entrega o gesto
  // horizontal para nós.
  function aoTocar(e: React.PointerEvent<HTMLDivElement>) {
    arrastou.current = false;
    if (e.pointerType === "mouse" || emTransicao.current) return;
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
      if (!t.horizontal) {
        toque.current = null;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    arrastou.current = true;
    setArrasto(dx);
  }

  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    const t = toque.current;
    toque.current = null;
    if (!t?.horizontal) return;
    const dx = e.clientX - t.x;
    const limite = Math.min(60, e.currentTarget.clientWidth * 0.15);
    setArrasto(0);
    if (dx <= -limite) proximo();
    else if (dx >= limite) anterior();
  }

  function aoCancelar() {
    toque.current = null;
    setArrasto(0);
  }

  // Faixa: [cópia do último, ...banners, cópia do primeiro]
  const faixa = [
    { banner: banners[n - 1], indice: n - 1, copia: true },
    ...banners.map((banner, indice) => ({ banner, indice, copia: false })),
    { banner: banners[0], indice: 0, copia: true },
  ];

  const botaoSeta =
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-texto shadow-flutuante ring-1 ring-black/5 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gale-500 md:h-11 md:w-11";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Destaques da Galé"
      className={`${CAIXA} ${moldura(quadradoNoCelular)}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && setMouseSobre(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setMouseSobre(false)}
      onFocus={(e) => {
        // Só foco de TECLADO pausa: clicar numa seta com o mouse não deve
        // deixar o carrossel parado até a pessoa clicar em outro lugar.
        if (e.target.matches(":focus-visible")) setFocoTeclado(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocoTeclado(false);
      }}
    >
      <div
        id={idSlides}
        aria-live={girando ? "off" : "polite"}
        className="absolute inset-0 touch-pan-y select-none"
        onPointerDown={aoTocar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoCancelar}
        onClickCapture={(e) => {
          // Fim de um arrasto não é clique no link do banner.
          if (arrastou.current) {
            e.preventDefault();
            e.stopPropagation();
            arrastou.current = false;
          }
        }}
      >
        <div
          className={`flex h-full ${comTransicao ? "transition-transform duration-[550ms] ease-out" : ""}`}
          style={{ transform: `translate3d(calc(${-posicao * 100}% + ${arrasto}px), 0, 0)` }}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && e.propertyName === "transform") terminar();
          }}
        >
          {faixa.map(({ banner, indice, copia }, k) => {
            const visivel = k === posicao;
            return (
              <div
                key={copia ? `copia-${k}` : banner.id}
                role={copia ? undefined : "group"}
                aria-roledescription={copia ? undefined : "slide"}
                aria-label={copia ? undefined : `${indice + 1} de ${n}`}
                aria-hidden={!visivel || undefined}
                inert={!visivel}
                className="relative h-full w-full shrink-0"
              >
                <ConteudoBanner
                  banner={banner}
                  quadradoNoCelular={quadradoNoCelular}
                  prioridade={!copia && indice === 0}
                  carregar={carregarTodos && !(copia && indice === 0)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={anterior}
        aria-controls={idSlides}
        aria-label="Banner anterior"
        className={`${botaoSeta} left-2 md:left-4`}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="m12.5 4.5-5.5 5.5 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={proximo}
        aria-controls={idSlides}
        aria-label="Próximo banner"
        className={`${botaoSeta} right-2 md:right-4`}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="m7.5 4.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Pontinhos + pausa sobre um fundo escuro translúcido: contraste
          garantido em cima de qualquer arte. Cada alvo tem 24 px de toque. */}
      <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm md:bottom-3">
        <button
          type="button"
          onClick={() => setEscolha(automatico ? "pausado" : "tocando")}
          aria-label={
            automatico
              ? "Pausar a troca automática dos banners"
              : "Ligar a troca automática dos banners"
          }
          className="flex h-6 w-6 items-center justify-center rounded-full text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
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
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onClick={() => i !== atual && irPara(i + 1)}
            aria-controls={idSlides}
            aria-label={`Mostrar o banner ${i + 1} de ${n}`}
            aria-current={i === atual ? "true" : undefined}
            className="group flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white"
          >
            <span
              className={`block h-2 rounded-full transition-all ${
                i === atual ? "w-5 bg-white" : "w-2 bg-white/55 group-hover:bg-white/85"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

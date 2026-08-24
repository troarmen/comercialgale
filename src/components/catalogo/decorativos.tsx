/**
 * Elementos decorativos de fundo do catálogo.
 *
 * A linguagem é a do atacado — grade modular, caixas empilhadas, pontos de
 * distribuição — sempre em baixa opacidade, atrás do conteúdo, invisível para
 * leitor de tela e imune a clique. Nada aqui carrega imagem: é borda, cor de
 * token e duas animações de transform que o compositor resolve de graça.
 */

/** Textura de grade modular, esmaecida nas bordas. */
export function PadraoGrade() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 fundo-grade mascara-suave"
    />
  );
}

/** Textura de pontos (malha de distribuição). */
export function PadraoPontos() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 fundo-pontos mascara-suave opacity-70"
    />
  );
}

type Caixa = {
  classe: string;
  giro: string;
  flutua?: "flutua" | "flutua-lento";
};

/*
 * "Caixas" abstratas — quadrados arredondados que sugerem volume e estoque.
 * Posições fixas pensadas para os cantos do hero; quem usa esconde no mobile.
 */
const CAIXAS: Caixa[] = [
  { classe: "right-[6%] top-10 h-16 w-16 border-2 border-gale-200/70", giro: "8deg", flutua: "flutua" },
  { classe: "right-[2%] top-40 h-9 w-9 bg-gale-100/80", giro: "-10deg", flutua: "flutua-lento" },
  { classe: "left-[38%] top-6 h-10 w-10 border-2 border-borda-forte/70", giro: "12deg", flutua: "flutua-lento" },
  { classe: "bottom-8 left-[30%] h-14 w-14 border-2 border-borda-forte/60", giro: "-6deg", flutua: "flutua" },
  { classe: "bottom-24 right-[30%] h-7 w-7 bg-superficie-2", giro: "18deg" },
  { classe: "left-[52%] top-28 h-5 w-5 rounded-md bg-gale-200/60", giro: "0deg", flutua: "flutua" },
];

export function CaixasFlutuantes() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {CAIXAS.map((c, i) => (
        <span
          key={i}
          style={{ "--giro": c.giro } as React.CSSProperties}
          className={`absolute rounded-xl ${c.flutua ?? ""} ${c.classe}`}
        />
      ))}
    </div>
  );
}

/** Brilho radial muito suave com a cor da marca, para um canto de seção. */
export function BrilhoMarca({ posicao = "direita" }: { posicao?: "direita" | "esquerda" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -top-24 h-64 w-64 rounded-full bg-gale-500/8 blur-3xl sm:h-96 sm:w-96 ${
        posicao === "direita" ? "-right-24" : "-left-24"
      }`}
    />
  );
}

/**
 * Marca da Galé — o coração vermelho do logo da loja, redesenhado em SVG para
 * ficar nítido em qualquer tamanho e herdar a cor do tema.
 */
export function Coracao({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 22" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 20.5S2.5 14.6 2.5 8.3C2.5 5 5 2.5 8 2.5c1.9 0 3.3 1 4 2.2.7-1.2 2.1-2.2 4-2.2 3 0 5.5 2.5 5.5 5.8 0 6.3-9.5 12.2-9.5 12.2Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Coracao className="h-6 w-6 shrink-0 text-gale-500" />
      {!compacta && (
        <div className="leading-none">
          <div className="text-lg font-semibold tracking-tight text-white">
            Galé
          </div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-menu-texto">
            Comercial
          </div>
        </div>
      )}
    </div>
  );
}

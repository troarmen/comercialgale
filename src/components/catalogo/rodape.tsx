import Image from "next/image";
import Link from "next/link";
import { arvoreCategorias } from "@/lib/catalogo";
import { CONTATO, linkWhatsApp } from "@/lib/contato";

const INSTITUCIONAL = [
  { href: "/produtos", nome: "Todos os produtos" },
  { href: "/lancamentos", nome: "Lançamentos" },
  { href: "/marcas", nome: "Marcas" },
  { href: "/empresa", nome: "A Galé" },
  { href: "/contato", nome: "Contato" },
  { href: "/cadastro", nome: "Quero comprar no atacado" },
  { href: "/entrar", nome: "Já sou cliente" },
];

export async function Rodape() {
  const categorias = await arvoreCategorias();

  return (
    <footer className="mt-16 border-t border-borda bg-superficie">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="inline-block rounded-xl bg-(--logo-placa) px-1.5 py-1">
            <Image
              src="/logo-gale.png"
              alt="Galé Super Atacado — 50 anos de tradição"
              width={460}
              height={426}
              className="h-20 w-auto"
            />
          </span>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-suave">
            Atacado de lingerie, meias, cuecas e pijamas desde {CONTATO.fundacao},
            na {CONTATO.endereco.regiao}, em São Paulo.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <a
              href={CONTATO.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram da Comercial Galé"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-borda text-suave transition hover:border-borda-forte hover:text-acento-texto"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" aria-hidden="true">
                <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="12" cy="12" r="3.8" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
              </svg>
            </a>
            <a
              href={CONTATO.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook da Comercial Galé"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-borda text-suave transition hover:border-borda-forte hover:text-acento-texto"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" aria-hidden="true">
                <path
                  d="M14 8.5V7.2c0-.7.5-1.2 1.2-1.2H16V3.5h-2.2c-2 0-3.3 1.5-3.3 3.5v1.5H8.5V12h2v8.5H14V12h2.2l.5-3.5H14Z"
                  fill="currentColor"
                />
              </svg>
            </a>
          </div>
        </div>

        <nav aria-label="Categorias no rodapé">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tenue">
            Categorias
          </h2>
          <ul className="mt-3 space-y-2">
            {categorias.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/produtos/${c.slug}`}
                  className="text-sm text-suave transition hover:text-acento-texto"
                >
                  {c.nome} no atacado
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Links institucionais">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tenue">
            Navegação
          </h2>
          <ul className="mt-3 space-y-2">
            {INSTITUCIONAL.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-sm text-suave transition hover:text-acento-texto"
                >
                  {l.nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tenue">
            Atendimento
          </h2>
          <address className="mt-3 space-y-2 text-sm not-italic text-suave">
            <p>
              {CONTATO.endereco.logradouro}
              <br />
              {CONTATO.endereco.bairro} — {CONTATO.endereco.cidade}/{CONTATO.endereco.uf}
            </p>
            <p>{CONTATO.horario}</p>
            <p>
              <a href={`tel:+55${CONTATO.telefoneFixo.replace(/\D/g, "")}`} className="transition hover:text-acento-texto">
                {CONTATO.telefoneFixo}
              </a>
              <br />
              <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="transition hover:text-acento-texto">
                {CONTATO.whatsapp} (WhatsApp)
              </a>
            </p>
            <p>
              <a href={`mailto:${CONTATO.email}`} className="break-all transition hover:text-acento-texto">
                {CONTATO.email}
              </a>
            </p>
          </address>
        </div>
      </div>

      <div className="border-t border-borda">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-xs text-tenue">
            © {new Date().getFullYear()} {CONTATO.razao} Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Botão flutuante de WhatsApp — principal canal de contato do atacado. */
export function BotaoWhatsApp() {
  return (
    <a
      href={linkWhatsApp()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Galé pelo WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-flutuante transition duration-200 hover:scale-105"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
        <path d="M12 2a9.9 9.9 0 0 0-8.6 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.1 4c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.3 3.9 2.1.9 2.6.7 3 .7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.2-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.3.1-.5l.5-.6c.1-.2.1-.3.2-.5v-.4L10.6 8c-.1-.3-.3-.3-.5-.3h-1.2Z" />
      </svg>
    </a>
  );
}

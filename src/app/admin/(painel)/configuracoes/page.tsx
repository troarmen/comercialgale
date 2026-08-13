import type { Metadata } from "next";
import { criarClienteServidor } from "@/lib/supabase/server";
import { FormularioConfiguracoes } from "./formulario";

export const metadata: Metadata = { title: "Configurações · Galé Comercial" };

/**
 * As configurações vivem numa tabela chave/valor com JSON no valor. Ler exige
 * afunilar o tipo, porque `Json` pode ser qualquer coisa — daí estes ajudantes.
 */
function comoNumero(v: unknown, padrao = 0) {
  return typeof v === "number" ? v : padrao;
}
function comoTexto(v: unknown, padrao = "") {
  return typeof v === "string" ? v : padrao;
}
function comoLista(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function comoBooleano(v: unknown, padrao = true) {
  return typeof v === "boolean" ? v : padrao;
}

export default async function PaginaConfiguracoes() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("configuracoes").select("chave, valor");

  const mapa = new Map((data ?? []).map((c) => [c.chave, c.valor]));

  return (
    <div className="px-8 py-7">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-suave">
          Ajustes que valem para todo o catálogo.
        </p>
      </header>

      <FormularioConfiguracoes
        minimo={comoNumero(mapa.get("pedido_minimo_valor"))}
        emails={comoLista(mapa.get("emails_notificacao"))}
        aviso={comoTexto(mapa.get("catalogo_aviso"))}
        exibirVarejo={comoBooleano(mapa.get("exibir_preco_varejo"))}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Paginacao } from "@/components/paginacao";
import { numero } from "@/lib/formato";
import { criarClienteServidor } from "@/lib/supabase/server";
import { FiltrosClientes } from "./filtros";

export const metadata: Metadata = { title: "Clientes · Galé Comercial" };

const POR_PAGINA = 30;

const SITUACAO = {
  ativo: { nome: "Ativo", cor: "bg-ok-fundo text-ok-texto", ponto: "bg-ok-texto" },
  incompleto: {
    nome: "Incompleto",
    cor: "bg-alerta-fundo text-alerta-texto",
    ponto: "bg-alerta-texto",
  },
  inativo: { nome: "Inativo", cor: "bg-tenue/15 text-suave", ponto: "bg-tenue" },
} as const;

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{
    busca?: string;
    status?: string;
    acesso?: string;
    tipo?: string;
    pagina?: string;
  }>;
}) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const de = (pagina - 1) * POR_PAGINA;

  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("clientes")
    .select(
      "id, nome, nome_fantasia, documento, email, telefone1, cidade, uf, status, tipo_pessoa, user_id, pode_ver_precos",
      { count: "exact" },
    );

  if (sp.busca?.trim()) {
    const t = sp.busca.trim().replace(/[(),]/g, " ");
    // Uma busca só cobrindo os quatro campos que o Arthur usa para achar alguém
    consulta = consulta.or(
      `nome.ilike.%${t}%,nome_fantasia.ilike.%${t}%,email.ilike.%${t}%,documento.ilike.%${t}%,cidade.ilike.%${t}%`,
    );
  }
  if (sp.status === "ativo" || sp.status === "inativo" || sp.status === "incompleto") {
    consulta = consulta.eq("status", sp.status);
  }
  if (sp.tipo === "fisica" || sp.tipo === "juridica") {
    consulta = consulta.eq("tipo_pessoa", sp.tipo);
  }
  if (sp.acesso === "com") consulta = consulta.not("user_id", "is", null);
  if (sp.acesso === "sem") consulta = consulta.is("user_id", null);

  const { data, count } = await consulta
    .order("nome")
    .range(de, de + POR_PAGINA - 1);

  const lista = data ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const { count: semLogin } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .eq("status", "ativo");

  return (
    <div className="px-8 py-7">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-suave">
            {numero(total)} {total === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-acento px-3.5 text-sm font-semibold text-white transition hover:bg-acento-forte"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Novo cliente
        </Link>
      </header>

      {!!semLogin && !sp.acesso && (
        <p className="mb-4 rounded-lg border border-borda bg-alerta-fundo px-3.5 py-2.5 text-sm text-alerta-texto">
          {numero(semLogin)} clientes ativos ainda não têm login e por isso não
          enxergam preço no catálogo.{" "}
          <Link href="?acesso=sem&status=ativo" className="font-medium underline">
            Ver quem são
          </Link>
        </p>
      )}

      <div className="mb-4">
        <FiltrosClientes />
      </div>

      <div className="overflow-hidden rounded-xl border border-borda bg-superficie">
        {lista.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-texto">Nenhum cliente</p>
            <p className="mt-1 text-sm text-suave">
              Ajuste os filtros ou cadastre um cliente novo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 text-center font-medium">Acesso</th>
                  <th className="px-4 py-3 text-center font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const s = SITUACAO[c.status];
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-borda last:border-0 transition hover:bg-superficie-2"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/clientes/${c.id}`}
                          className="font-medium text-texto hover:text-acento-texto"
                        >
                          {c.nome}
                        </Link>
                        <div className="text-xs text-suave">
                          {c.tipo_pessoa === "juridica" ? "CNPJ" : "CPF"}{" "}
                          {c.documento || "não informado"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-suave">
                        <div className="truncate">{c.email ?? "—"}</div>
                        {c.telefone1 && (
                          <div className="text-xs">{c.telefone1}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-suave">
                        {c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {c.user_id ? (
                          c.pode_ver_precos ? (
                            <span className="rounded-full bg-ok-fundo px-2 py-0.5 text-xs font-medium text-ok-texto">
                              vê preço
                            </span>
                          ) : (
                            <span className="rounded-full bg-alerta-fundo px-2 py-0.5 text-xs font-medium text-alerta-texto">
                              preço suspenso
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-tenue">sem login</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.cor}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.ponto}`} />
                          {s.nome}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paginas > 1 && (
        <Paginacao pagina={pagina} paginas={paginas} total={total} />
      )}
    </div>
  );
}

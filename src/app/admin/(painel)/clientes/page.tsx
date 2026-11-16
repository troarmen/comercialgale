import type { Metadata } from "next";
import Link from "next/link";
import {
  CabecalhoOrdenavel,
  lerOrdem,
  type Direcao,
} from "@/components/cabecalho-ordenavel";
import { Paginacao } from "@/components/paginacao";
import { LembrarLista } from "@/components/voltar";
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

/*
 * Colunas que ordenam a lista e a direção do primeiro clique. "Cadastro"
 * começa pelos mais novos: o pedido do cliente (nov/2026) foi justamente "ver
 * os últimos clientes cadastrados".
 */
const COLUNAS = {
  nome: "asc",
  cidade: "asc",
  cadastro: "desc",
} satisfies Record<string, Direcao>;

/*
 * Data de cadastro. `cadastrado_em` é `date` puro ("2019-03-12"): passar por
 * `new Date()` o leria como meia-noite UTC, e em São Paulo isso vira o dia
 * anterior — por isso é só reordenado. `created_at` (o reserva) é um instante
 * e precisa do fuso.
 */
const DIA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function dataCadastro(cadastradoEm: string | null, createdAt: string) {
  const dia = cadastradoEm?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  return DIA_SP.format(new Date(createdAt));
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{
    busca?: string;
    status?: string;
    acesso?: string;
    tipo?: string;
    ordem?: string;
    dir?: string;
    pagina?: string;
  }>;
}) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const de = (pagina - 1) * POR_PAGINA;
  const ordem = lerOrdem(sp, COLUNAS, { campo: "nome", dir: "asc" });

  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("clientes")
    .select(
      "id, nome, nome_fantasia, documento, email, telefone1, cidade, uf, status, tipo_pessoa, user_id, pode_ver_precos, cadastrado_em, created_at",
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

  const asc = ordem.dir === "asc";
  if (ordem.campo === "cadastro") {
    // Cliente sem `cadastrado_em` é cadastro recente feito pelo site (a 004
    // preencheu todos os antigos; a 010 preenche estes e põe valor padrão).
    // Enquanto a 010 não roda, eles precisam vir PRIMEIRO em "mais novos" e
    // por último em "mais antigos" — e, entre eles, `created_at` decide.
    consulta = consulta
      .order("cadastrado_em", { ascending: asc, nullsFirst: !asc })
      .order("created_at", { ascending: asc });
  } else if (ordem.campo === "cidade") {
    consulta = consulta
      .order("cidade", { ascending: asc, nullsFirst: false })
      .order("uf", { ascending: asc, nullsFirst: false })
      .order("nome");
  } else {
    consulta = consulta.order("nome", { ascending: asc });
  }

  // `id` no fim: com nomes ou datas empatados, nenhum cliente aparece em
  // duas páginas nem some entre elas.
  const { data, count } = await consulta
    .order("id", { ascending: asc })
    .range(de, de + POR_PAGINA - 1);

  const lista = data ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const { count: semLogin } = await supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .eq("status", "ativo");

  const titulo = (
    campo: keyof typeof COLUNAS,
    rotulo: string,
    tipo?: "data",
  ) => (
    <CabecalhoOrdenavel
      campo={campo}
      rotulo={rotulo}
      ordem={ordem}
      primeira={COLUNAS[campo]}
      tipo={tipo}
      caminho="/admin/clientes"
      params={sp}
    />
  );

  return (
    <div className="px-8 py-7">
      {/* Guarda busca, filtros, ordem, página e rolagem para o Voltar da
          ficha do cliente devolver a lista como estava. */}
      <LembrarLista chave="clientes" />

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
                  {titulo("nome", "Cliente")}
                  <th scope="col" className="px-4 py-3 font-medium">Contato</th>
                  {titulo("cidade", "Cidade")}
                  {titulo("cadastro", "Cadastro", "data")}
                  <th scope="col" className="px-4 py-3 text-center font-medium">Acesso</th>
                  <th scope="col" className="px-4 py-3 text-center font-medium">Situação</th>
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
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-suave">
                        {dataCadastro(c.cadastrado_em, c.created_at)}
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

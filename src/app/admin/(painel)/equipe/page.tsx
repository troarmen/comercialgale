import type { Metadata } from "next";
import { dataCurta } from "@/lib/pedidos";
import { exigirAdminPagina } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/server";
import { AcoesColaborador, NovoColaborador } from "./controles";

export const metadata: Metadata = { title: "Equipe · Galé Comercial" };

const PAPEL = { admin: "Administrador", colaborador: "Colaborador" } as const;

export default async function PaginaEquipe() {
  const { supabase, user } = await exigirAdminPagina();

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, role, ativo, created_at")
    .in("role", ["admin", "colaborador"])
    .order("role")
    .order("nome");

  // `profiles` não guarda e-mail — ele vive no Auth. A equipe é pequena, uma
  // consulta por pessoa basta (listUsers traria todos os lojistas junto).
  const auth = criarClienteAdmin().auth.admin;
  const pessoas = await Promise.all(
    (data ?? []).map(async (p) => {
      const { data: u } = await auth.getUserById(p.id);
      return { ...p, email: u.user?.email ?? null, ultimoAcesso: u.user?.last_sign_in_at ?? null };
    }),
  );

  return (
    <div className="px-8 py-7">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">Equipe</h1>
        <p className="mt-1 text-sm text-suave">
          Quem entra no painel. Colaboradores consultam pedidos e mudam a
          situação deles — nada além disso.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="overflow-hidden rounded-xl border border-borda bg-superficie">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-tenue">
                  <th className="px-4 py-2.5 font-medium">Pessoa</th>
                  <th className="px-4 py-2.5 font-medium">Papel</th>
                  <th className="px-4 py-2.5 font-medium">Último acesso</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pessoas.map((p) => {
                  const papel = p.role === "admin" ? "admin" : "colaborador";
                  return (
                    <tr key={p.id} className="border-b border-borda last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="text-texto">
                          {p.nome}
                          {p.id === user.id && <span className="ml-1.5 text-xs text-tenue">(você)</span>}
                        </div>
                        <div className="break-all text-xs text-suave">{p.email ?? "—"}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-suave">{PAPEL[papel]}</span>
                        {!p.ativo && (
                          <span className="ml-2 rounded bg-tenue/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-suave">
                            desativado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-suave">
                        {p.ultimoAcesso ? dataCurta(p.ultimoAcesso) : "nunca entrou"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {papel === "colaborador" && (
                          <AcoesColaborador id={p.id} nome={p.nome} ativo={p.ativo} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside>
          <NovoColaborador />
        </aside>
      </div>
    </div>
  );
}

import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/server";

/**
 * Clientes que receberam login na migração e ainda NÃO criaram a senha
 * (relatório do cliente de 24/11, item 5.3).
 *
 * Como sabemos: os logins dos clientes antigos foram criados sem senha
 * (scripts/criar_logins_clientes.py); a pessoa só entra depois de criar a
 * senha pelo link — e abrir o link já é o primeiro acesso. Então "nunca
 * entrou" (`last_sign_in_at` vazio no Auth) = "ainda não criou a senha".
 * Só clientes ATIVOS: bloqueado ou inativo não recebe convite.
 *
 * Usa a chave mestra (o Auth não é legível pela sessão): só chame depois de
 * `exigirAdmin()` / `exigirAdminPagina()`.
 */

export const TIPO_CONVITE = "convite para criar senha";

/** Convites por clique (ver acoes.ts: cota diária do Brevo e tempo da função). */
export const TAMANHO_LOTE = 25;

/** Quem recebeu convite há menos que isso espera o próximo lote. */
const INTERVALO_DIAS = 7;

/** A fila do próximo lote: nunca convidados ou convidados há mais de 7 dias. */
export function filaDeConvite(pendentes: PendenteSenha[]) {
  const limite = Date.now() - INTERVALO_DIAS * 24 * 3600 * 1000;
  return pendentes.filter(
    (p) => !p.ultimoConvite || new Date(p.ultimoConvite).getTime() < limite,
  );
}

export type PendenteSenha = {
  id: number;
  nome: string;
  nomeFantasia: string | null;
  cidade: string | null;
  uf: string | null;
  email: string;
  /** último convite deste lote que saiu (ISO), ou null */
  ultimoConvite: string | null;
};

export async function pendentesDeSenha(): Promise<PendenteSenha[]> {
  const admin = criarClienteAdmin();

  const nuncaEntrou = new Map<string, string>(); // user_id → e-mail
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (!u.last_sign_in_at && u.email) nuncaEntrou.set(u.id, u.email);
    }
    if (data.users.length < 1000) break;
  }
  if (!nuncaEntrou.size) return [];

  const clientes: {
    id: number;
    nome: string;
    nome_fantasia: string | null;
    cidade: string | null;
    uf: string | null;
    user_id: string | null;
  }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin
      .from("clientes")
      .select("id, nome, nome_fantasia, cidade, uf, user_id")
      .eq("status", "ativo")
      .not("user_id", "is", null)
      .order("id")
      .range(de, de + 999);
    if (error) throw error;
    clientes.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const ultimo = new Map<string, string>();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await admin
      .from("log_atividades")
      .select("entidade_id, created_at")
      .eq("entidade", "clientes")
      .eq("acao", "email_enviado")
      .eq("detalhes->>tipo", TIPO_CONVITE)
      .order("created_at")
      .range(de, de + 999);
    if (error) throw error;
    for (const l of data ?? []) if (l.entidade_id) ultimo.set(l.entidade_id, l.created_at);
    if (!data || data.length < 1000) break;
  }

  return clientes
    .filter((c) => c.user_id && nuncaEntrou.has(c.user_id))
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      nomeFantasia: c.nome_fantasia,
      cidade: c.cidade,
      uf: c.uf,
      email: nuncaEntrou.get(c.user_id!)!,
      ultimoConvite: ultimo.get(String(c.id)) ?? null,
    }));
}

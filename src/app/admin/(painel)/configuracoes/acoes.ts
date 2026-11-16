"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";

export type EstadoConfig = { ok?: boolean; erro?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * Converte "1.234,56" ou "1234.56" ou "1234" em número.
 * O Arthur digita como brasileiro; o banco guarda como número.
 */
function paraNumero(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return 0;
  // com vírgula, o ponto é separador de milhar
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

export async function salvarConfiguracoes(
  _anterior: EstadoConfig,
  form: FormData,
): Promise<EstadoConfig> {
  // Confere que é admin antes de escrever. O RLS já barraria, mas em silêncio
  // (UPDATE sem política afeta 0 linhas) — uma mensagem clara é melhor.
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;

  const minimo = paraNumero(String(form.get("pedido_minimo_valor") ?? "0"));
  if (minimo === null || minimo < 0) {
    return { erro: "O valor mínimo do pedido precisa ser um número positivo." };
  }

  const emails = String(form.get("emails_notificacao") ?? "")
    .split(/[\n,;]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const invalido = emails.find((e) => !EMAIL.test(e));
  if (invalido) return { erro: `E-mail inválido: ${invalido}` };

  const aviso = String(form.get("catalogo_aviso") ?? "").trim();
  if (aviso.length > 280) {
    return { erro: "O aviso do catálogo passou de 280 caracteres." };
  }

  const exibirVarejo = form.get("exibir_preco_varejo") === "on";
  const cadastroAutomatico = form.get("cadastro_aprovacao_automatica") === "on";

  const valores: Record<string, unknown> = {
    pedido_minimo_valor: minimo,
    emails_notificacao: [...new Set(emails)],
    catalogo_aviso: aviso,
    exibir_preco_varejo: exibirVarejo,
  };

  const agora = new Date().toISOString();
  for (const [chave, valor] of Object.entries(valores)) {
    const { error } = await supabase
      .from("configuracoes")
      .update({ valor: valor as never, updated_at: agora })
      .eq("chave", chave);

    if (error) {
      return { erro: `Não foi possível salvar "${chave}": ${error.message}` };
    }
  }

  // Chave nova (nov/2026): o banco de produção não tem a linha até alguém
  // salvar esta tela, e UPDATE em linha que não existe afeta 0 linhas sem
  // erro — por isso upsert. Sem migração: ausente, o cadastro lê LIGADA.
  const { error: erroCadastro } = await supabase.from("configuracoes").upsert(
    {
      chave: "cadastro_aprovacao_automatica",
      valor: cadastroAutomatico,
      descricao:
        "Cadastro pelo site já sai com preço liberado (true) ou aguarda a equipe ativar na ficha (false).",
      updated_at: agora,
    },
    { onConflict: "chave" },
  );
  if (erroCadastro) {
    return {
      erro: `Não foi possível salvar "cadastro_aprovacao_automatica": ${erroCadastro.message}`,
    };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string };

export async function entrar(
  _anterior: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const destino = String(form.get("destino") ?? "/admin");

  if (!email || !senha) {
    return { erro: "Preencha e-mail e senha." };
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user) {
    // Mensagem genérica de propósito: dizer "este e-mail não existe" entrega a
    // quem tenta invadir quais contas são válidas.
    return { erro: "E-mail ou senha incorretos." };
  }

  // Autenticar não basta — o painel é só para a equipe (admin ou colaborador).
  // Um cliente do catálogo tem login válido e não pode entrar aqui.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, ativo")
    .eq("id", data.user.id)
    .single();

  const daEquipe = perfil?.role === "admin" || perfil?.role === "colaborador";
  if (!perfil || !daEquipe || !perfil.ativo) {
    await supabase.auth.signOut();
    return { erro: "Esta conta não tem acesso ao painel." };
  }

  // Só aceita caminho interno: sem isso, `?destino=https://site-falso` faria o
  // login redirecionar a pessoa para fora depois de autenticar.
  const seguro = destino.startsWith("/") && !destino.startsWith("//")
    ? destino
    : "/admin";

  redirect(seguro);
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

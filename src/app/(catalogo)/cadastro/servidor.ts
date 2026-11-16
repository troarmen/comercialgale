import { createHmac, timingSafeEqual } from "node:crypto";
import { criarClienteAdmin } from "@/lib/supabase/server";

/*
 * Peças do cadastro que só rodam no servidor. SEM "use server" de propósito:
 * num arquivo "use server" cada função exportada vira um endpoint chamável de
 * fora, e nada aqui deve ser chamado pelo navegador.
 */

// ------------------------------------------------------- tempo de preenchimento

/** Ninguém preenche razão social, documento, e-mail e duas senhas em 3 s. */
const TEMPO_MINIMO_MS = 3000;

function assinar(instante: string) {
  // A chave mestra só existe no servidor; aqui ela só serve de segredo do
  // HMAC, nunca sai do processo.
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", segredo).update(`cadastro:${instante}`).digest("base64url");
}

/**
 * Carimbo do momento em que o formulário foi desenhado, assinado: o robô
 * pode reenviar o campo, mas não consegue inventar um carimbo antigo para
 * pular a espera. Vai num <input type="hidden">.
 */
export function carimboDoFormulario() {
  const instante = String(Date.now());
  return `${instante}.${assinar(instante)}`;
}

/**
 * "ok" | "rapido" (enviado em menos de 3 s) | "invalido" (sem carimbo, ou
 * carimbo forjado). Sem prazo máximo: aba esquecida aberta de um dia para o
 * outro continua valendo.
 */
export function conferirCarimbo(carimbo: string) {
  const [instante, assinatura] = carimbo.split(".");
  if (!instante || !assinatura) return "invalido" as const;
  const esperado = Buffer.from(assinar(instante));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    return "invalido" as const;
  }
  return Date.now() - Number(instante) < TEMPO_MINIMO_MS ? ("rapido" as const) : ("ok" as const);
}

// ------------------------------------------------------- liberação automática

/**
 * Configurações → "Liberar cadastro automaticamente". Lida com a service_role
 * porque a política pública de `configuracoes` só abre três chaves.
 *
 * Chave ausente = LIGADA: é o pedido do cliente (nov/2026) e o comportamento
 * de produção antes de qualquer pessoa salvar a tela. Em dúvida (erro de
 * leitura), também liga — o pior caso é um lojista vendo preço, que a equipe
 * suspende na ficha; o contrário travaria todo cadastro novo em silêncio.
 */
export async function aprovacaoAutomatica() {
  const { data, error } = await criarClienteAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "cadastro_aprovacao_automatica")
    .maybeSingle();
  if (error) console.error("[cadastro] não li a liberação automática:", error.message);
  return data?.valor !== false;
}

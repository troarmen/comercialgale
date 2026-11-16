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
/**
 * Validade do carimbo. Sem prazo, um robô baixava a página UMA vez, esperava
 * 3 s uma vez e reaproveitava o mesmo carimbo em quantos envios quisesse.
 * Com prazo, ele precisa buscar carimbo novo de tempos em tempos. Duas horas
 * dão folga a quem preenche com calma.
 */
const VALIDADE_MS = 2 * 60 * 60 * 1000;

function assinar(instante: string) {
  // A chave mestra só existe no servidor; aqui ela só serve de segredo do
  // HMAC, nunca sai do processo.
  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", segredo).update(`cadastro:${instante}`).digest("base64url");
}

/**
 * Carimbo do momento em que o formulário foi desenhado, assinado: não dá para
 * inventar um carimbo antigo para pular a espera, só reaproveitar um
 * verdadeiro dentro da validade. Vai num <input type="hidden">.
 *
 * É uma trava contra robô simples, NÃO um limite de envios: não segura quem
 * busca a página antes de cada envio. Limite por IP (regra de rate limit no
 * Firewall da Vercel para POST /cadastro) ou captcha ficam fora do código.
 */
export function carimboDoFormulario() {
  const instante = String(Date.now());
  return `${instante}.${assinar(instante)}`;
}

/**
 * "ok" | "rapido" (enviado em menos de 3 s) | "vencido" (passou da validade:
 * aba esquecida aberta — a action pede para recarregar a página) |
 * "invalido" (sem carimbo, ou forjado).
 */
export function conferirCarimbo(carimbo: string) {
  const [instante, assinatura] = carimbo.split(".");
  if (!instante || !assinatura) return "invalido" as const;
  const esperado = Buffer.from(assinar(instante));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    return "invalido" as const;
  }
  const idade = Date.now() - Number(instante);
  if (idade < TEMPO_MINIMO_MS) return "rapido" as const;
  if (idade > VALIDADE_MS) return "vencido" as const;
  return "ok" as const;
}

// ------------------------------------------------------- liberação automática

/**
 * Configurações → "Liberar cadastro automaticamente". Lida com a service_role
 * porque a política pública de `configuracoes` só abre três chaves.
 *
 * Chave ausente = LIGADA: é o pedido do cliente (nov/2026) e o comportamento
 * de produção antes de qualquer pessoa salvar a tela.
 *
 * Erro de leitura = DESLIGADA. Se a equipe desligou (por abuso, digamos),
 * uma instabilidade do banco não pode abrir o preço para quem se cadastrar
 * nessa janela. Desligado não trava ninguém: o login nasce do mesmo jeito,
 * como 'incompleto', e a casa recebe o aviso "para liberar".
 */
export async function aprovacaoAutomatica(): Promise<{ ligada: boolean; falhou: boolean }> {
  const { data, error } = await criarClienteAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "cadastro_aprovacao_automatica")
    .maybeSingle();
  if (error) {
    console.error("[cadastro] não li a liberação automática, tratando como desligada:", error.message);
    return { ligada: false, falhou: true };
  }
  return { ligada: data?.valor !== false, falhou: false };
}

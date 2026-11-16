/**
 * Validações de cadastro que valem no navegador e no servidor (funções puras,
 * sem banco nem segredo — pode importar de qualquer lado).
 */

export type TipoPessoa = "fisica" | "juridica";

export const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/**
 * Documento como o banco guarda: só os caracteres que contam.
 *
 * CPF é só dígito. CNPJ aceita LETRA nas 12 primeiras posições: desde
 * julho/2026 a Receita emite CNPJ alfanumérico para empresa nova (IN RFB
 * 2.229/2024) — tirar tudo que não é dígito, como se fazia, apagaria parte do
 * documento de quem abriu a loja agora. Os 1.825 cadastros antigos são todos
 * numéricos e continuam iguais.
 */
export function normalizarDocumento(tipo: TipoPessoa, texto: string) {
  return tipo === "fisica"
    ? texto.replace(/\D/g, "")
    : texto.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function cpfValido(cpf: string) {
  // 000.000.000-00, 111.111.111-11… passam na conta, mas não existem.
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string) => {
    const peso = base.length + 1;
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (peso - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(cpf.slice(0, 9));
  const d2 = digito(cpf.slice(0, 10));
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/**
 * CNPJ numérico ou alfanumérico. A regra da Receita é uma só para os dois:
 * cada caractere vale o código ASCII menos 48 (dígito continua valendo ele
 * mesmo; A = 17, B = 18…), pesos 2 a 9 da direita para a esquerda, módulo 11.
 * Os dois dígitos verificadores são sempre numéricos.
 */
export function cnpjValido(cnpj: string) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digito = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      const peso = ((base.length - 1 - i) % 8) + 2;
      soma += (base.charCodeAt(i) - 48) * peso;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(cnpj.slice(0, 12));
  const d2 = digito(cnpj.slice(0, 12) + d1);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

export function documentoValido(tipo: TipoPessoa, documento: string) {
  return tipo === "fisica" ? cpfValido(documento) : cnpjValido(documento);
}

/** 00.000.000/0000-00 ou 000.000.000-00; o que não tiver o tamanho volta cru. */
export function formatarDocumento(documento: string | null | undefined) {
  const d = (documento ?? "").trim();
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (/^\d{11}$/.test(d))
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return d;
}

/**
 * "lojista@teste.com.br" → "lo•••@teste.com.br". Para dizer a quem digitou um
 * documento já cadastrado QUAL e-mail usar, sem entregar o endereço inteiro
 * a quem só sabe o CNPJ.
 */
export function mascararEmail(email: string | null | undefined) {
  const [usuario, dominio] = (email ?? "").trim().split("@");
  if (!usuario || !dominio) return null;
  return `${usuario.slice(0, Math.min(2, usuario.length - 1) || 1)}•••@${dominio}`;
}

/**
 * Data de hoje no fuso de São Paulo (AAAA-MM-DD). O servidor da Vercel roda
 * em UTC: um cadastro feito às 22h de um dia 31 cairia no mês seguinte.
 */
export function hojeEmSaoPaulo(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

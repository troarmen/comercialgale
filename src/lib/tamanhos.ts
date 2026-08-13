/**
 * Classificação dos valores de tamanho.
 *
 * Fica fora do arquivo de ações porque módulos marcados com "use server" só
 * podem exportar funções assíncronas — exportar uma constante de lá derruba a
 * página com erro 500.
 */
export const TIPOS = [
  { valor: "tamanho", nome: "Tamanho", exemplo: "P, M, G, GG, 38, 40" },
  { valor: "numeracao", nome: "Numeração de pé", exemplo: "33 a 36, 39 a 42" },
  { valor: "faixa_etaria", nome: "Faixa etária", exemplo: "RN, 0 a 3 meses" },
  { valor: "grade", nome: "Grade fechada", exemplo: "4P/4M/4G" },
  { valor: "cor", nome: "Cor", exemplo: "TU - Branco" },
  { valor: "outro", nome: "Outro", exemplo: "" },
] as const;

export const NOME_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS.map((t) => [t.valor, t.nome]),
);

/**
 * Gera o identificador que vai na URL do catálogo.
 * "Calças Adultos" -> "calcas-adultos"
 */
export function paraSlug(texto: string) {
  return (
    texto
      .normalize("NFKD")
      // ̀-ͯ é a faixa dos acentos que o NFKD separa da letra
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "sem-nome"
  );
}

/**
 * Encontra um slug livre, acrescentando -2, -3… se já existir.
 * `jaUsado` recebe o candidato e responde se está ocupado.
 */
export async function slugLivre(
  base: string,
  jaUsado: (candidato: string) => Promise<boolean>,
) {
  let slug = base;
  for (let n = 2; n < 50; n++) {
    if (!(await jaUsado(slug))) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

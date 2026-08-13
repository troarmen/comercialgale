/**
 * Prepara a foto no NAVEGADOR antes de enviar ao servidor.
 *
 * O celular do Arthur tira foto de 4 MB. Mandar isso cru para o servidor é
 * lento na conexão dele e cai no limite de tamanho da requisição. Reduzindo
 * aqui, o que sobe são uns 150 KB — e já no mesmo formato usado na migração,
 * então o catálogo fica consistente.
 */
export const LARGURA_MAX = 1600;
export const QUALIDADE = 0.82;

export type FotoPreparada = {
  arquivo: File;
  previa: string;
  larguraOriginal: number;
  pesoOriginal: number;
};

export async function prepararFoto(original: File): Promise<FotoPreparada> {
  const bitmap = await createImageBitmap(original);

  const escala = Math.min(1, LARGURA_MAX / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;

  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");

  // Fundo branco: PNG com transparência ficaria preto ao virar WebP opaco.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    tela.toBlob(resolve, "image/webp", QUALIDADE),
  );
  if (!blob) throw new Error("Não foi possível converter a imagem.");

  const nome = original.name.replace(/\.[^.]+$/, "") + ".webp";
  return {
    arquivo: new File([blob], nome, { type: "image/webp" }),
    previa: URL.createObjectURL(blob),
    larguraOriginal: bitmap.width,
    pesoOriginal: original.size,
  };
}

export function pesoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

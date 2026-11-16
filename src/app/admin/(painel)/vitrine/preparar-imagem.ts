/**
 * Prepara banner e logo NO NAVEGADOR antes de subir — a mesma ideia de
 * `src/lib/imagem.ts` (fotos de produto), com duas diferenças que pedem
 * função própria:
 *
 *   • o banner tem moldura fixa (3:1 ou quadrada). Recortamos aqui, pelo
 *     centro, para o arquivo guardado ter EXATAMENTE a proporção em que vai
 *     aparecer — o Arthur vê na prévia o que a loja vai mostrar, e a loja não
 *     baixa pixel que ninguém vê. O otimizador de imagem do Next está
 *     desligado (cota da Vercel), então o tamanho certo tem de sair daqui;
 *   • o logo precisa manter a TRANSPARÊNCIA (as fotos de produto ganham fundo
 *     branco; o logo, não).
 *
 * WebP sempre que o navegador souber gerar. O Safari antigo ignora o pedido
 * de WebP no canvas e devolve PNG — conferimos o tipo que de fato saiu e,
 * no banner, caímos para JPEG (PNG de foto pesa demais).
 */

export type ImagemPreparada = {
  arquivo: File;
  previa: string;
  largura: number;
  altura: number;
  larguraOriginal: number;
  alturaOriginal: number;
  pesoOriginal: number;
  /** A proporção original era outra e o centro foi recortado. */
  recortada: boolean;
  /** Menor que o recomendado: vai aparecer esticada em tela grande. */
  pequena: boolean;
};

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

function gerar(tela: HTMLCanvasElement, tipo: string, qualidade: number) {
  return new Promise<Blob | null>((resolve) => tela.toBlob(resolve, tipo, qualidade));
}

async function codificar(tela: HTMLCanvasElement, reserva: "image/jpeg" | "image/png") {
  const webp = await gerar(tela, "image/webp", 0.85);
  if (webp?.type === "image/webp") return webp;
  const outro = await gerar(tela, reserva, 0.88);
  if (!outro) throw new Error("Não foi possível converter a imagem.");
  return outro;
}

const EXTENSAO: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

async function abrir(original: File) {
  if (!TIPOS_ACEITOS.includes(original.type)) {
    throw new Error(`"${original.name}" não é JPG, PNG nem WebP.`);
  }
  try {
    return await createImageBitmap(original);
  } catch {
    throw new Error(`Não foi possível abrir "${original.name}".`);
  }
}

async function finalizar(
  tela: HTMLCanvasElement,
  original: File,
  bitmap: ImageBitmap,
  reserva: "image/jpeg" | "image/png",
  extra: { recortada: boolean; pequena: boolean },
): Promise<ImagemPreparada> {
  const blob = await codificar(tela, reserva);
  const nome = `${original.name.replace(/\.[^.]+$/, "")}.${EXTENSAO[blob.type] ?? "webp"}`;
  return {
    arquivo: new File([blob], nome, { type: blob.type }),
    previa: URL.createObjectURL(blob),
    largura: tela.width,
    altura: tela.height,
    larguraOriginal: bitmap.width,
    alturaOriginal: bitmap.height,
    pesoOriginal: original.size,
    ...extra,
  };
}

/**
 * Banner: recorta pelo centro na proporção do alvo e reduz até a largura do
 * alvo. Nunca amplia — uma imagem pequena sobe como está (e o painel avisa).
 */
export async function prepararBanner(
  original: File,
  alvo: { largura: number; altura: number },
): Promise<ImagemPreparada> {
  const bitmap = await abrir(original);
  const proporcao = alvo.largura / alvo.altura;
  const atual = bitmap.width / bitmap.height;

  // Até 2% de diferença não vale recortar: ninguém percebe, e evita comer a
  // borda de uma arte feita "quase" no tamanho.
  const recortada = Math.abs(atual / proporcao - 1) > 0.02;
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (recortada && atual > proporcao) {
    sw = Math.round(bitmap.height * proporcao);
    sx = Math.round((bitmap.width - sw) / 2);
  } else if (recortada) {
    sh = Math.round(bitmap.width / proporcao);
    sy = Math.round((bitmap.height - sh) / 2);
  }

  const largura = Math.min(alvo.largura, sw);
  const altura = Math.round(largura / (recortada ? proporcao : atual));

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  // Banner é arte de fundo cheio; PNG com transparência viraria preto no JPEG
  // de reserva.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, largura, altura);

  const pronto = await finalizar(tela, original, bitmap, "image/jpeg", {
    recortada,
    pequena: largura < alvo.largura * 0.75,
  });
  bitmap.close();
  return pronto;
}

/** Logo: só reduz a largura, preservando proporção e transparência. */
export async function prepararLogo(
  original: File,
  larguraMax: number,
): Promise<ImagemPreparada> {
  const bitmap = await abrir(original);
  const escala = Math.min(1, larguraMax / bitmap.width);
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, largura, altura);

  const pronto = await finalizar(tela, original, bitmap, "image/png", {
    recortada: false,
    pequena: largura < 200,
  });
  bitmap.close();
  return pronto;
}

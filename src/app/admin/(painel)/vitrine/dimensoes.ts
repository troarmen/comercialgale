/**
 * Lê o tipo e o tamanho de uma imagem pelos PRIMEIROS BYTES do arquivo.
 *
 * O servidor não confia no `type` que o navegador declara nem na largura que
 * o formulário manda: o arquivo vai para um bucket público, e a largura e a
 * altura guardadas viram o `width`/`height` do <img> na loja (errar ali faz a
 * página pular ao carregar). Os três formatos que aceitamos guardam isso no
 * cabeçalho, então não precisa de biblioteca nenhuma.
 */

export type InfoImagem = {
  tipo: "image/webp" | "image/png" | "image/jpeg";
  extensao: "webp" | "png" | "jpg";
  largura: number;
  altura: number;
};

function ascii(b: Uint8Array, de: number, ate: number) {
  return String.fromCharCode(...b.subarray(de, ate));
}

function png(b: Uint8Array): InfoImagem | null {
  const assinatura = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || assinatura.some((x, i) => b[i] !== x)) return null;
  if (ascii(b, 12, 16) !== "IHDR") return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { tipo: "image/png", extensao: "png", largura: v.getUint32(16), altura: v.getUint32(20) };
}

function webp(b: Uint8Array): InfoImagem | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 12) !== "WEBP") return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const pedaco = ascii(b, 12, 16);
  let largura = 0;
  let altura = 0;
  if (pedaco === "VP8 ") {
    // com perda: 14 bits de largura e de altura depois do código de início
    largura = v.getUint16(26, true) & 0x3fff;
    altura = v.getUint16(28, true) & 0x3fff;
  } else if (pedaco === "VP8L") {
    // sem perda: largura-1 e altura-1 em 14 bits cada, empacotados
    const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
    largura = 1 + (((b1 & 0x3f) << 8) | b0);
    altura = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
  } else if (pedaco === "VP8X") {
    // estendido (é o que o canvas gera com transparência): 24 bits cada
    largura = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    altura = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
  } else {
    return null;
  }
  return { tipo: "image/webp", extensao: "webp", largura, altura };
}

function jpeg(b: Uint8Array): InfoImagem | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marcador = b[i + 1];
    // SOF0–SOF15 trazem o tamanho; C4 (Huffman), C8 e CC não são quadro.
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return {
        tipo: "image/jpeg",
        extensao: "jpg",
        altura: v.getUint16(i + 5),
        largura: v.getUint16(i + 7),
      };
    }
    i += 2 + v.getUint16(i + 2);
  }
  return null;
}

export async function lerInfoImagem(arquivo: File): Promise<InfoImagem | null> {
  // 64 KB bastam: o quadro do JPEG vem depois do EXIF, que raramente passa disso.
  const b = new Uint8Array(await arquivo.slice(0, 65536).arrayBuffer());
  const info = png(b) ?? webp(b) ?? jpeg(b);
  if (!info || !info.largura || !info.altura) return null;
  return info;
}

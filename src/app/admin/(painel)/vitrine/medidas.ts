/**
 * Medidas da vitrine — as mesmas no painel (o que pedir e para onde reduzir)
 * e na loja (a moldura do carrossel). Arquivo puro, sem nada de servidor:
 * o formulário, que roda no navegador, importa daqui.
 *
 * Por que estas: a moldura do banner é 3:1 no computador e quadrada no
 * celular. 1920 px cobre a largura útil da loja (1248 px) com folga para tela
 * de alta densidade; 1080 px é o tamanho que o celular do Arthur já exporta
 * para o Instagram, então a arte do feed serve direto.
 */
export const MEDIDAS = {
  computador: { largura: 1920, altura: 640, rotulo: "1920 × 640 px (3:1)" },
  celular: { largura: 1080, altura: 1080, rotulo: "1080 × 1080 px (quadrada)" },
  /** O logo aparece com 48–80 px de altura: 600 px de largura sobra. */
  logo: { largura: 600 },
} as const;

/** Limite do arquivo JÁ reduzido. Um banner 1920×640 em WebP dá ~200 KB. */
export const PESO_MAXIMO = 4 * 1024 * 1024;

export const ALT_MAXIMO = 160;

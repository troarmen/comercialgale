"""
Recorta o fundo branco de estúdio de uma foto de produto e grava um WebP com
transparência — as peças penduradas dos banners padrão do topo da home
(design/banners-padrao/pecas/; ver design/banners-padrao/banner.html).

Uso:
    python3 scripts/recortar_peca.py <url-ou-arquivo> design/banners-padrao/pecas/<nome>.webp \
        [--apagar x0,y0,x1,y1] [--buracos 1500]

Como funciona: o branco ligado à borda da foto vira transparente (preenchimento
a partir das bordas), então o branco DENTRO da peça — etiqueta, renda clara —
fica. Duas opções para fotos teimosas:
  --apagar   retângulo (em pixels da foto original) onde tudo que não for a cor
             da peça vira fundo; usado para sumir com a etiqueta preta que
             aparecia atrás do sutiã 9189.
  --buracos  área mínima de branco FECHADO pela peça que também vira fundo
             (o vão entre a alça e o bojo). Não use em peça com etiqueta
             branca grande, ela sumiria junto.
  --limiar   quão claro um pixel precisa ser para contar como fundo (padrão
             226; baixe para ~200 quando a foto tem sombra cinza em volta).
  --erosao   quantos pixels a borda da peça encolhe (padrão 3, ímpar); suba
             para 5 quando sobrar um contorno claro.
Depois de gerar, confira sobre fundo colorido: recorte ruim aparece como
borda branca.

Requer Pillow e numpy.
"""

import argparse
import io
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def abrir(origem: str) -> Image.Image:
    if origem.startswith("http"):
        return Image.open(io.BytesIO(urllib.request.urlopen(origem).read()))
    return Image.open(origem)


def recortar(im: Image.Image, apagar=None, buracos=0, lado=600, limiar=226, erosao=3) -> Image.Image:
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    mn, mx = a.min(2), a.max(2)
    fundo = (mn > limiar) & ((mx - mn) < 20)  # quase branco e sem cor
    if apagar:
        x0, y0, x1, y1 = apagar
        regiao = np.zeros_like(fundo)
        regiao[y0:y1, x0:x1] = True
        fundo |= regiao & ~(a[..., 0] > a[..., 1] + 40)

    # .copy(): a imagem criada de um array numpy é só leitura e o floodfill
    # falharia calado
    m = Image.fromarray(np.where(fundo, 255, 0).astype(np.uint8)).copy()
    h, w = fundo.shape
    borda = [(x, y) for x in range(w) for y in (0, h - 1)]
    borda += [(x, y) for y in range(h) for x in (0, w - 1)]
    for p in borda:
        if m.getpixel(p) == 255:
            ImageDraw.floodfill(m, p, 128)

    if buracos:
        for y, x in zip(*np.nonzero(np.asarray(m) == 255)):
            p = (int(x), int(y))
            if m.getpixel(p) != 255:
                continue
            ImageDraw.floodfill(m, p, 100)
            n = int((np.asarray(m) == 100).sum())
            ImageDraw.floodfill(m, p, 128 if n > buracos else 50)

    alfa = Image.fromarray(np.where(np.asarray(m) == 128, 0, 255).astype(np.uint8))
    alfa = alfa.filter(ImageFilter.MinFilter(erosao)).filter(ImageFilter.GaussianBlur(0.9))
    al = np.asarray(alfa).astype(np.float32) / 255

    # tira o halo branco da borda suavizada
    cor = np.clip(
        (a.astype(np.float32) - (1 - al[..., None]) * 255) / np.maximum(al, 0.05)[..., None],
        0,
        255,
    )
    out = Image.fromarray(np.dstack([cor, al * 255]).astype(np.uint8), "RGBA")
    out = out.crop(out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    out.thumbnail((lado, lado), Image.LANCZOS)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("origem")
    ap.add_argument("destino")
    ap.add_argument("--apagar", type=lambda s: tuple(int(v) for v in s.split(",")))
    ap.add_argument("--buracos", type=int, default=0)
    ap.add_argument("--limiar", type=int, default=226)
    ap.add_argument("--erosao", type=int, default=3)
    args = ap.parse_args()
    out = recortar(abrir(args.origem), args.apagar, args.buracos, limiar=args.limiar, erosao=args.erosao)
    out.save(args.destino, "WEBP", quality=80, method=6)
    print(args.destino, out.size)


if __name__ == "__main__":
    main()

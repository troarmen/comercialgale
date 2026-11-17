/**
 * Gera os banners padrão do topo da home a partir de banner.html.
 *
 *   MODULOS=<pasta com node_modules/puppeteer-core> node design/banners-padrao/gerar.mjs
 *
 * O puppeteer-core NÃO é dependência do projeto (só serve para isto): instale
 * numa pasta qualquer (`npm i puppeteer-core` fora do repo) e aponte MODULOS
 * para ela. Usa o Chrome instalado no Mac. Saída em public/banners/, no
 * tamanho exato que o painel pede (1920×640 e 1080×1080), em WebP.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.env.MODULOS ?? aqui, "x.js"));
const puppeteer = require("puppeteer-core");

const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SAIDA = join(aqui, "..", "..", "public", "banners");
const FORMATOS = { computador: [1920, 640], celular: [1080, 1080] };

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
const pagina = await navegador.newPage();
for (const banner of ["lingerie", "cuecas"]) {
  for (const [formato, [largura, altura]] of Object.entries(FORMATOS)) {
    await pagina.setViewport({ width: largura, height: altura, deviceScaleFactor: 1 });
    const url = pathToFileURL(join(aqui, "banner.html"));
    url.search = `b=${banner}&f=${formato}`;
    await pagina.goto(url.href, { waitUntil: "networkidle0" });
    await pagina.evaluate(() => window.prontas);
    const arquivo = join(SAIDA, `padrao-${banner}-${formato}.webp`);
    await pagina.screenshot({ path: arquivo, type: "webp", quality: 86 });
    console.log(arquivo);
  }
}
await navegador.close();

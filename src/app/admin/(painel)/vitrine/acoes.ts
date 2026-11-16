"use server";

import { revalidatePath } from "next/cache";
import { gruposDaBusca } from "@/lib/busca";
import { urlFoto } from "@/lib/formato";
import { URL_SITE } from "@/lib/seo";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";
import { criarClienteAdmin, criarClienteServidor } from "@/lib/supabase/server";
import {
  CHAVES_VITRINE,
  interpretarVitrine,
  MAX_BANNERS,
  normalizarCaminho,
  normalizarEnderecoExterno,
  type BannerGuardado,
  type ImagemVitrine,
  type LinkBanner,
  type LogoGuardado,
} from "@/lib/vitrine";
import { lerInfoImagem } from "./dimensoes";
import { ALT_MAXIMO, PESO_MAXIMO } from "./medidas";

/*
 * Ações da tela Vitrine. Todas começam com `exigirAdmin()`: a Server Action é
 * um endpoint próprio, chamável por qualquer sessão (inclusive a de um
 * lojista), e o Storage é escrito com a service role — que não tem RLS
 * nenhum para barrar. A ordem é sempre: confere quem é → valida → sobe o
 * arquivo → grava a configuração → só então apaga o arquivo antigo. Se a
 * gravação falhar, o arquivo recém-enviado é apagado; o antigo continua
 * valendo.
 *
 * A configuração é gravada com a sessão do admin (o RLS "admin total" vale
 * como segunda cerca); só o Storage usa a chave mestra.
 */

export type EstadoVitrine = { ok?: boolean; erro?: string };

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

const BUCKET = "produtos";

function revalidar() {
  revalidatePath("/admin/vitrine");
  // Cabeçalho e rodapé (logo) estão no layout da loja: invalida tudo abaixo.
  revalidatePath("/", "layout");
}

async function lerAtual(supabase: Supabase) {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [...CHAVES_VITRINE]);
  if (error) throw new Error(error.message);
  return interpretarVitrine(data);
}

async function gravar(
  supabase: Supabase,
  chave: (typeof CHAVES_VITRINE)[number],
  valor: unknown,
  descricao: string,
) {
  // upsert: as chaves da vitrine não existem no banco até o primeiro envio
  // (nenhuma migração as cria). `configuracoes` não tem trava de coluna,
  // então o upsert funciona com a sessão do admin.
  const { error } = await supabase.from("configuracoes").upsert({
    chave,
    valor: valor as never,
    descricao,
    updated_at: new Date().toISOString(),
  });
  return error?.message ?? null;
}

const DESCRICAO_BANNERS = "Banners do topo da página inicial (painel → Vitrine).";
const DESCRICAO_LOGO = "Logo da loja (painel → Vitrine). Ausente = logo original.";

/** Nome único por envio: arquivo trocado nunca fica preso em cache. */
function nomeArquivo(prefixo: string, extensao: string) {
  const marca = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  return `vitrine/${prefixo}-${marca}.${extensao}`;
}

async function apagarArquivos(caminhos: (string | null | undefined)[]) {
  const lista = caminhos.filter((c): c is string => !!c && c.startsWith("vitrine/"));
  if (!lista.length) return;
  const { error } = await criarClienteAdmin().storage.from(BUCKET).remove(lista);
  // Sobra de arquivo não quebra nada na loja; só registra.
  if (error) console.error("[vitrine] não apagou do bucket:", lista, error.message);
}

/**
 * Confere e sobe um arquivo. Devolve a imagem guardada, ou o erro em texto.
 * O tipo e o tamanho vêm dos BYTES do arquivo (dimensoes.ts), não do que o
 * navegador declarou.
 *
 * Sobe os BYTES, não o File: com um File/Blob o storage-js manda multipart e
 * IGNORA a opção `contentType` — o bucket público guardaria e serviria o
 * `type` que o navegador declarou (um pedido montado à mão poderia pôr
 * image/svg+xml). Com o ArrayBuffer, o Content-Type é o que lemos no
 * cabeçalho da imagem.
 */
async function subir(
  arquivo: File,
  prefixo: string,
  rotulo: string,
): Promise<ImagemVitrine | string> {
  if (arquivo.size > PESO_MAXIMO) {
    return `A imagem ${rotulo} passou de 4 MB mesmo depois de reduzida.`;
  }
  const info = await lerInfoImagem(arquivo);
  if (!info) return `A imagem ${rotulo} não é um JPG, PNG ou WebP válido.`;
  if (info.largura > 4000 || info.altura > 4000) {
    return `A imagem ${rotulo} é grande demais (${info.largura} × ${info.altura} px).`;
  }

  const caminho = nomeArquivo(prefixo, info.extensao);
  const { error } = await criarClienteAdmin()
    .storage.from(BUCKET)
    .upload(caminho, await arquivo.arrayBuffer(), {
      contentType: info.tipo,
      upsert: false,
      // Nome único por envio = conteúdo imutável: pode ficar um ano em cache.
      cacheControl: "31536000",
    });
  if (error) return `Falha no envio da imagem ${rotulo}: ${error.message}`;
  return { caminho, largura: info.largura, altura: info.altura };
}

function arquivoDe(form: FormData, campo: string) {
  const v = form.get(campo);
  return v instanceof File && v.size > 0 ? v : null;
}

// ----------------------------------------------------------------- links

/**
 * Monta o link do banner a partir do formulário. Só sai daqui `http(s)://`
 * de outro site, caminho começando com UMA barra ou produto existente.
 */
async function linkDoFormulario(
  supabase: Supabase,
  form: FormData,
): Promise<{ link: LinkBanner | null } | { erro: string }> {
  const tipo = String(form.get("link_tipo") ?? "nenhum");

  if (tipo === "nenhum") return { link: null };

  if (tipo === "pagina") {
    const texto = String(form.get("link_pagina") ?? "").trim();
    const href = normalizarCaminho(texto);
    if (!href) {
      return {
        erro: "O endereço da página precisa começar com / — por exemplo /produtos/meias.",
      };
    }
    return { link: { tipo: "pagina", href } };
  }

  if (tipo === "externo") {
    const texto = String(form.get("link_externo") ?? "");
    const u = normalizarEnderecoExterno(texto);
    if (!u) {
      return {
        erro: "Endereço de site inválido. Use o endereço completo, como https://www.instagram.com/comercialgale.",
      };
    }
    // Colou um endereço do PRÓPRIO site? Vira página: abre na mesma aba e
    // continua valendo se o domínio mudar.
    const semWww = (h: string) => h.replace(/^www\./, "");
    if (semWww(u.hostname) === semWww(new URL(URL_SITE).hostname)) {
      const href = normalizarCaminho(`${u.pathname}${u.search}${u.hash}`);
      if (href) return { link: { tipo: "pagina", href } };
    }
    return { link: { tipo: "externo", href: u.toString() } };
  }

  if (tipo === "produto") {
    const id = Number(form.get("link_produto_id") ?? 0);
    if (!Number.isInteger(id) || id <= 0) {
      return { erro: "Escolha o produto do link (busque pela referência ou pelo nome)." };
    }
    const { data: produto } = await supabase
      .from("produtos")
      .select("id, slug, titulo, modelo, ativo")
      .eq("id", id)
      .maybeSingle();
    if (!produto) return { erro: "O produto escolhido não existe mais." };
    if (!produto.ativo) {
      return { erro: "O produto escolhido está desativado — o banner levaria a uma página vazia." };
    }
    return {
      link: {
        tipo: "produto",
        produtoId: produto.id,
        href: `/produto/${produto.slug}`,
        rotulo: `${produto.modelo} — ${produto.titulo}`,
      },
    };
  }

  return { erro: "Tipo de link desconhecido." };
}

// --------------------------------------------------------------- banners

/**
 * Cria (sem `id`) ou edita (com `id`) um banner. Na edição, as imagens são
 * opcionais: o que não vier fica como estava.
 */
export async function salvarBanner(form: FormData): Promise<EstadoVitrine> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  const id = String(form.get("id") ?? "").trim() || null;
  const alt = String(form.get("alt") ?? "").trim().replace(/\s+/g, " ");
  if (alt.length < 3) {
    return { erro: "Escreva o texto alternativo: o que o banner mostra, em uma frase." };
  }
  if (alt.length > ALT_MAXIMO) {
    return { erro: `O texto alternativo passou de ${ALT_MAXIMO} caracteres.` };
  }

  const resultadoLink = await linkDoFormulario(supabase, form);
  if ("erro" in resultadoLink) return { erro: resultadoLink.erro };

  let atual: BannerGuardado[];
  try {
    atual = (await lerAtual(supabase)).banners;
  } catch (e) {
    return { erro: `Não foi possível ler os banners: ${(e as Error).message}` };
  }

  const anterior = id ? atual.find((b) => b.id === id) : null;
  if (id && !anterior) return { erro: "Este banner não existe mais. Recarregue a página." };
  if (!id && atual.length >= MAX_BANNERS) {
    return { erro: `O limite é de ${MAX_BANNERS} banners. Exclua um para adicionar outro.` };
  }

  const arqComputador = arquivoDe(form, "arquivo_computador");
  const arqCelular = arquivoDe(form, "arquivo_celular");
  const removerCelular = form.get("remover_celular") === "on";
  if (!anterior && !arqComputador) {
    return { erro: "Envie a imagem para computador — ela é obrigatória." };
  }

  // Sobe o que chegou. Qualquer falha desfaz os envios desta chamada.
  const enviados: string[] = [];
  let computador = anterior?.computador ?? null;
  let celular = removerCelular ? null : (anterior?.celular ?? null);

  if (arqComputador) {
    const r = await subir(arqComputador, "banner-computador", "para computador");
    if (typeof r === "string") return { erro: r };
    enviados.push(r.caminho);
    computador = r;
  }
  if (arqCelular) {
    const r = await subir(arqCelular, "banner-celular", "para celular");
    if (typeof r === "string") {
      await apagarArquivos(enviados);
      return { erro: r };
    }
    enviados.push(r.caminho);
    celular = r;
  }

  const banner: BannerGuardado = {
    id: anterior?.id ?? crypto.randomUUID(),
    alt,
    ativo: form.get("ativo") === "on",
    computador: computador!,
    celular,
    link: resultadoLink.link,
  };

  const nova = anterior
    ? atual.map((b) => (b.id === anterior.id ? banner : b))
    : [...atual, banner];

  const erro = await gravar(supabase, "vitrine_banners", nova, DESCRICAO_BANNERS);
  if (erro) {
    await apagarArquivos(enviados);
    return { erro: `Não foi possível salvar o banner: ${erro}` };
  }

  // Gravou: agora sim os arquivos substituídos podem sair do bucket.
  if (anterior) {
    await apagarArquivos([
      arqComputador ? anterior.computador.caminho : null,
      arqCelular || removerCelular ? anterior.celular?.caminho : null,
    ]);
  }

  await supabase.from("log_atividades").insert({
    user_id: user.id,
    acao: anterior ? "editou" : "criou",
    entidade: "banner",
    entidade_id: banner.id,
    detalhes: { alt },
  });

  revalidar();
  return { ok: true };
}

/** Mexe na lista inteira e grava — base de subir/descer, ativar e excluir. */
async function alterarLista(
  mudar: (lista: BannerGuardado[]) => BannerGuardado[] | string,
): Promise<EstadoVitrine & { removidos?: BannerGuardado[]; userId?: string }> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  let atual: BannerGuardado[];
  try {
    atual = (await lerAtual(supabase)).banners;
  } catch (e) {
    return { erro: `Não foi possível ler os banners: ${(e as Error).message}` };
  }

  const nova = mudar(atual);
  if (typeof nova === "string") return { erro: nova };

  const erro = await gravar(supabase, "vitrine_banners", nova, DESCRICAO_BANNERS);
  if (erro) return { erro: `Não foi possível salvar: ${erro}` };

  revalidar();
  return {
    ok: true,
    removidos: atual.filter((b) => !nova.some((n) => n.id === b.id)),
    userId: user.id,
  };
}

export async function moverBanner(id: string, direcao: -1 | 1): Promise<EstadoVitrine> {
  const r = await alterarLista((lista) => {
    const i = lista.findIndex((b) => b.id === id);
    const j = i + direcao;
    if (i < 0) return "Este banner não existe mais. Recarregue a página.";
    if (j < 0 || j >= lista.length) return lista;
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    return nova;
  });
  return { ok: r.ok, erro: r.erro };
}

export async function alternarBanner(id: string, ativo: boolean): Promise<EstadoVitrine> {
  const r = await alterarLista((lista) =>
    lista.some((b) => b.id === id)
      ? lista.map((b) => (b.id === id ? { ...b, ativo } : b))
      : "Este banner não existe mais. Recarregue a página.",
  );
  return { ok: r.ok, erro: r.erro };
}

export async function excluirBanner(id: string): Promise<EstadoVitrine> {
  const r = await alterarLista((lista) =>
    lista.some((b) => b.id === id)
      ? lista.filter((b) => b.id !== id)
      : "Este banner não existe mais. Recarregue a página.",
  );
  if (r.ok && r.removidos?.length) {
    await apagarArquivos(r.removidos.flatMap((b) => [b.computador.caminho, b.celular?.caminho]));
    const supabase = await criarClienteServidor();
    await supabase.from("log_atividades").insert({
      user_id: r.userId,
      acao: "excluiu",
      entidade: "banner",
      entidade_id: id,
      detalhes: { alt: r.removidos[0].alt },
    });
  }
  return { ok: r.ok, erro: r.erro };
}

export type ProdutoParaLink = {
  id: number;
  titulo: string;
  modelo: string;
  foto: string | null;
};

/**
 * Busca de produto para o link do banner — a MESMA busca do catálogo
 * (referência, nome, marca, sem acento). Só produto ativo: link para produto
 * desativado cairia numa página vazia.
 */
export async function buscarProdutosParaBanner(termo: string): Promise<ProdutoParaLink[]> {
  const sessao = await exigirAdmin();
  if (!sessao) return [];
  const { supabase } = sessao;

  const grupos = await gruposDaBusca(supabase, termo.slice(0, 80));
  if (!grupos.length) return [];

  let consulta = supabase
    .from("produtos")
    .select("id, titulo, modelo, produto_imagens(storage_path, principal, ordem)")
    .eq("ativo", true);
  for (const g of grupos) consulta = consulta.or(g);

  const { data } = await consulta.order("modelo").limit(8);
  return (data ?? []).map((p) => {
    const fotos = [...(p.produto_imagens ?? [])].sort(
      (a, b) => Number(b.principal) - Number(a.principal) || a.ordem - b.ordem,
    );
    return {
      id: p.id,
      titulo: p.titulo,
      modelo: p.modelo,
      foto: urlFoto(fotos[0]?.storage_path),
    };
  });
}

// ------------------------------------------------------------------- logo

/**
 * Troca o logo (com arquivo) ou só o texto alternativo (sem arquivo, quando
 * já há logo próprio).
 */
export async function salvarLogo(form: FormData): Promise<EstadoVitrine> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  const alt = String(form.get("alt") ?? "").trim().replace(/\s+/g, " ") || "Comercial Galé";
  if (alt.length > ALT_MAXIMO) {
    return { erro: `O texto alternativo passou de ${ALT_MAXIMO} caracteres.` };
  }

  let anterior: LogoGuardado | null;
  try {
    anterior = (await lerAtual(supabase)).logo;
  } catch (e) {
    return { erro: `Não foi possível ler o logo atual: ${(e as Error).message}` };
  }

  const arquivo = arquivoDe(form, "arquivo");
  if (!arquivo && !anterior) return { erro: "Escolha o arquivo do logo novo." };

  let imagem: ImagemVitrine = anterior!;
  if (arquivo) {
    const r = await subir(arquivo, "logo", "do logo");
    if (typeof r === "string") return { erro: r };
    imagem = r;
  }

  const logo: LogoGuardado = {
    caminho: imagem.caminho,
    largura: imagem.largura,
    altura: imagem.altura,
    alt,
  };
  const erro = await gravar(supabase, "vitrine_logo", logo, DESCRICAO_LOGO);
  if (erro) {
    if (arquivo) await apagarArquivos([imagem.caminho]);
    return { erro: `Não foi possível salvar o logo: ${erro}` };
  }
  if (arquivo && anterior) await apagarArquivos([anterior.caminho]);

  await supabase.from("log_atividades").insert({
    user_id: user.id,
    acao: arquivo ? "trocou" : "editou",
    entidade: "logo",
    entidade_id: logo.caminho,
  });

  revalidar();
  return { ok: true };
}

/** Volta ao logo de /public: apaga a chave e o arquivo enviado. */
export async function restaurarLogo(): Promise<EstadoVitrine> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  let anterior: LogoGuardado | null;
  try {
    anterior = (await lerAtual(supabase)).logo;
  } catch (e) {
    return { erro: `Não foi possível ler o logo atual: ${(e as Error).message}` };
  }

  const { error } = await supabase.from("configuracoes").delete().eq("chave", "vitrine_logo");
  if (error) return { erro: `Não foi possível voltar ao logo original: ${error.message}` };
  if (anterior) await apagarArquivos([anterior.caminho]);

  await supabase.from("log_atividades").insert({
    user_id: user.id,
    acao: "restaurou",
    entidade: "logo",
    entidade_id: "original",
  });

  revalidar();
  return { ok: true };
}

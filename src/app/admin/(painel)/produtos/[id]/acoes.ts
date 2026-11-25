"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin, SEM_PERMISSAO } from "@/lib/sessao";
import { criarClienteAdmin } from "@/lib/supabase/server";
import { paraSlug, slugLivre } from "@/lib/texto";

export type EstadoProduto = { ok?: boolean; erro?: string };

function revalidar(id?: number) {
  revalidatePath("/admin/produtos");
  if (id) revalidatePath(`/admin/produtos/${id}`);
}

/** "31,80" ou "31.80" -> 31.8 · vazio -> 0 */
function dinheiro(v: FormDataEntryValue | null): number | null {
  const t = String(v ?? "").trim();
  if (!t) return 0;
  const limpo = t.replace(/[^\d,.-]/g, "");
  const n = Number(limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Grava o produto e a grade de tamanhos.
 *
 * A grade chega como três listas paralelas vindas do formulário:
 * `tamanho_id[]`, `tam_atacado[]` e `tam_varejo[]`.
 */
export async function salvarProduto(
  _anterior: EstadoProduto,
  form: FormData,
): Promise<EstadoProduto> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  const id = form.get("id") ? Number(form.get("id")) : null;
  const titulo = String(form.get("titulo") ?? "").trim();
  const modelo = String(form.get("modelo") ?? "").trim();

  if (titulo.length < 2) return { erro: "O nome do produto é obrigatório." };
  if (!modelo) return { erro: "A referência é obrigatória." };

  // Cadastro aberto pelo "Duplicar": a referência precisa ser outra. O banco
  // não exige referência única (há refs repetidas entre marcas), então a
  // conferência é contra o produto de origem — lido do banco, não do form.
  const duplicadoDe = id ? 0 : Number(form.get("duplicado_de") ?? 0);
  if (duplicadoDe > 0) {
    const { data: origem } = await supabase
      .from("produtos")
      .select("modelo")
      .eq("id", duplicadoDe)
      .maybeSingle();
    if (origem && origem.modelo.trim().toLowerCase() === modelo.toLowerCase()) {
      return {
        erro: `A referência ${modelo} é a do produto que foi duplicado. Informe a referência do produto novo.`,
      };
    }
  }

  const categoriaId = Number(form.get("categoria_id") ?? 0);
  const kitId = Number(form.get("kit_id") ?? 0);
  if (!categoriaId) return { erro: "Escolha a categoria." };
  if (!kitId) return { erro: "Escolha o kit (quantas peças vêm no pacote)." };

  const precoAtacado = dinheiro(form.get("preco_atacado"));
  const precoVarejo = dinheiro(form.get("preco_varejo"));
  if (precoAtacado === null) return { erro: "Preço de atacado inválido." };
  if (precoVarejo === null) return { erro: "Preço de varejo inválido." };

  const subcategoriaId = Number(form.get("subcategoria_id") ?? 0) || null;
  const fabricanteId = Number(form.get("fabricante_id") ?? 0) || null;

  const tags = String(form.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const slug = await slugLivre(paraSlug(`${titulo}-${modelo}`), async (cand) => {
    const { data } = await supabase
      .from("produtos")
      .select("id")
      .eq("slug", cand)
      .maybeSingle();
    return !!data && data.id !== id;
  });

  const campos = {
    titulo,
    modelo,
    slug,
    // O envio do formulário troca \n por \r\n; o banco guarda só \n, como
    // veio da migração. O negrito vai junto, como **trecho** (lib/descricao).
    descricao: String(form.get("descricao") ?? "").replace(/\r\n?/g, "\n").trim() || null,
    tags,
    categoria_id: categoriaId,
    subcategoria_id: subcategoriaId,
    fabricante_id: fabricanteId,
    kit_id: kitId,
    preco_atacado: precoAtacado,
    preco_varejo: precoVarejo,
    ncm: String(form.get("ncm") ?? "").trim() || null,
    possui_st: form.get("possui_st") === "on",
    ativo: form.get("ativo") === "on",
    lancamento: form.get("lancamento") === "on",
  };

  let produtoId = id;
  if (id) {
    const { error } = await supabase.from("produtos").update(campos).eq("id", id);
    if (error) return { erro: traduzir(error.message) };
  } else {
    const { data, error } = await supabase
      .from("produtos")
      .insert(campos)
      .select("id")
      .single();
    if (error || !data) return { erro: traduzir(error?.message ?? "") };
    produtoId = data.id;
  }

  // --- grade de tamanhos -----------------------------------------------------
  const ids = form.getAll("tamanho_id").map(Number);
  const atac = form.getAll("tam_atacado");
  const varej = form.getAll("tam_varejo");

  const grade = ids
    .map((tamanhoId, i) => ({
      produto_id: produtoId!,
      tamanho_id: tamanhoId,
      // vazio ou zero = herda o preço do produto
      preco_atacado: dinheiro(atac[i]) || null,
      preco_varejo: dinheiro(varej[i]) || null,
      ativo: true,
      ordem: i,
    }))
    .filter((l) => l.tamanho_id > 0);

  // Um tamanho repetido violaria a restrição do banco; avisamos antes.
  const vistos = new Set<number>();
  for (const l of grade) {
    if (vistos.has(l.tamanho_id)) {
      return { erro: "Há tamanhos repetidos na grade. Remova a duplicata." };
    }
    vistos.add(l.tamanho_id);
  }

  // Atualiza no lugar em vez de apagar e recriar a grade.
  //
  // O id de cada linha é o que o carrinho e o item de pedido guardam para
  // apontar "produto X no tamanho M". Se o Arthur salvar um produto enquanto
  // alguém está comprando, recriar as linhas trocaria esses ids por baixo do
  // cliente. Casamos linha a linha pelo tamanho e só removemos o que ele de
  // fato tirou da grade.
  //
  // Não dá para usar upsert aqui: `on conflict do update` exige SELECT na
  // tabela inteira, e a trava de preço revoga justamente isso. Por isso o
  // update é feito por id, um por linha — a grade tem meia dúzia delas.
  const { data: atuais, error: erroLeitura } = await supabase
    .from("produto_tamanhos")
    .select("id, tamanho_id")
    .eq("produto_id", produtoId!);
  if (erroLeitura) return { erro: traduzir(erroLeitura.message) };

  const existente = new Map((atuais ?? []).map((l) => [l.tamanho_id, l.id]));

  // Uma linha não depende da outra, então vão todas juntas: em série, uma
  // grade de seis tamanhos custava seis idas ao banco enfileiradas.
  const novos = grade.filter((l) => !existente.has(l.tamanho_id));
  const alterados = grade.filter((l) => existente.has(l.tamanho_id));
  const removidos = [...existente]
    .filter(([tamanhoId]) => !grade.some((l) => l.tamanho_id === tamanhoId))
    .map(([, id]) => id);

  const resultados = await Promise.all([
    ...alterados.map((linha) =>
      supabase
        .from("produto_tamanhos")
        .update({
          preco_atacado: linha.preco_atacado,
          preco_varejo: linha.preco_varejo,
          ativo: linha.ativo,
          ordem: linha.ordem,
        })
        .eq("id", existente.get(linha.tamanho_id)!),
    ),
    novos.length
      ? supabase.from("produto_tamanhos").insert(novos)
      : Promise.resolve({ error: null }),
    removidos.length
      ? supabase.from("produto_tamanhos").delete().in("id", removidos)
      : Promise.resolve({ error: null }),
  ]);

  const falha = resultados.find((r) => r.error);
  if (falha?.error) return { erro: traduzir(falha.error.message) };

  await supabase.from("log_atividades").insert({
    user_id: user.id,
    acao: id ? "editou" : "criou",
    entidade: "produto",
    entidade_id: String(produtoId),
  });

  revalidar(produtoId!);
  if (!id) redirect(`/admin/produtos/${produtoId}`);
  return { ok: true };
}

function traduzir(mensagem: string) {
  if (mensagem.includes("produtos_modelo") || mensagem.includes("modelo"))
    return "Já existe outro produto com esta referência.";
  if (mensagem.includes("slug"))
    return "Já existe outro produto com este nome e referência.";
  return mensagem || "Não foi possível salvar.";
}

// --------------------------------------------------------------------- fotos

/** Formato pela assinatura dos primeiros bytes; `null` se não for foto aceita. */
function formatoDaImagem(b: Uint8Array) {
  const ascii = (de: number, ate: number) => String.fromCharCode(...b.subarray(de, ate));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { tipo: "image/webp", extensao: "webp" };
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return { tipo: "image/png", extensao: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { tipo: "image/jpeg", extensao: "jpg" };
  return null;
}

export async function subirFoto(form: FormData): Promise<EstadoProduto> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;

  const produtoId = Number(form.get("produto_id"));
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size) {
    return { erro: "Nenhum arquivo recebido." };
  }
  if (arquivo.size > 8 * 1024 * 1024) {
    return { erro: "A imagem passou de 8 MB mesmo depois de reduzida." };
  }

  const { data: produto } = await supabase
    .from("produtos")
    .select("slug")
    .eq("id", produtoId)
    .single();
  if (!produto) return { erro: "Produto não encontrado." };

  const { data: existentes } = await supabase
    .from("produto_imagens")
    .select("id, ordem, principal")
    .eq("produto_id", produtoId)
    .order("ordem");

  // O tipo sai dos bytes, não do que o navegador declarou: o painel converte
  // para WebP antes de enviar, mas um navegador sem WebP no canvas entrega
  // PNG, e o File diz o que quiser.
  const conteudo = await arquivo.arrayBuffer();
  const formato = formatoDaImagem(new Uint8Array(conteudo, 0, Math.min(12, conteudo.byteLength)));
  if (!formato) return { erro: "O arquivo enviado não é uma imagem WebP, PNG ou JPEG." };

  const proximaOrdem = (existentes?.length ?? 0);
  // Nome único: se a foto for trocada, a antiga não fica em cache no navegador.
  const caminho = `${produto.slug}-${Date.now()}.${formato.extensao}`;

  // O upload usa a chave mestra porque o bucket não tem política de escrita
  // para o papel `authenticated` — e não queremos abrir isso: assim só o
  // servidor, depois de conferir a sessão, consegue gravar.
  //
  // Vai o ArrayBuffer, não o File: com File (ou Blob) o storage-js monta um
  // multipart e o Storage grava o tipo declarado pelo navegador, ignorando o
  // `contentType` — foi assim que subiu foto como application/octet-stream.
  // Com bytes crus, o `contentType` vira o Content-Type da requisição.
  const admin = criarClienteAdmin();
  const { error: erroUp } = await admin.storage
    .from("produtos")
    .upload(caminho, conteudo, { contentType: formato.tipo, upsert: false });

  if (erroUp) return { erro: `Falha no envio: ${erroUp.message}` };

  const { error } = await supabase.from("produto_imagens").insert({
    produto_id: produtoId,
    storage_path: caminho,
    ordem: proximaOrdem,
    principal: !existentes?.length, // a primeira vira a principal
  });

  if (error) {
    await admin.storage.from("produtos").remove([caminho]);
    return { erro: error.message };
  }

  revalidar(produtoId);
  return { ok: true };
}

export async function excluirFoto(
  imagemId: number,
  produtoId: number,
): Promise<EstadoProduto> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;

  const { data: img } = await supabase
    .from("produto_imagens")
    .select("storage_path, principal")
    .eq("id", imagemId)
    .single();
  if (!img) return { erro: "Foto não encontrada." };

  const { error } = await supabase
    .from("produto_imagens")
    .delete()
    .eq("id", imagemId);
  if (error) return { erro: error.message };

  await criarClienteAdmin().storage.from("produtos").remove([img.storage_path]);

  // Se a principal saiu, promove a próxima — produto sem foto principal não
  // aparece direito na listagem.
  if (img.principal) {
    const { data: resto } = await supabase
      .from("produto_imagens")
      .select("id")
      .eq("produto_id", produtoId)
      .order("ordem")
      .limit(1);
    if (resto?.[0]) {
      await supabase
        .from("produto_imagens")
        .update({ principal: true })
        .eq("id", resto[0].id);
    }
  }

  revalidar(produtoId);
  return { ok: true };
}

export async function definirPrincipal(
  imagemId: number,
  produtoId: number,
): Promise<EstadoProduto> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;
  // O índice único exige zerar antes de marcar a nova.
  await supabase
    .from("produto_imagens")
    .update({ principal: false })
    .eq("produto_id", produtoId);
  const { error } = await supabase
    .from("produto_imagens")
    .update({ principal: true })
    .eq("id", imagemId);
  if (error) return { erro: error.message };
  revalidar(produtoId);
  return { ok: true };
}

export async function reordenarFotos(
  produtoId: number,
  idsNaOrdem: number[],
): Promise<EstadoProduto> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase } = sessao;
  for (let i = 0; i < idsNaOrdem.length; i++) {
    await supabase
      .from("produto_imagens")
      .update({ ordem: i })
      .eq("id", idsNaOrdem[i]);
  }
  revalidar(produtoId);
  return { ok: true };
}

export async function excluirProduto(id: number): Promise<EstadoProduto> {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: SEM_PERMISSAO };
  const { supabase, user } = sessao;

  // Produto que já foi pedido também pode ser excluído (relatório do cliente
  // de 24/11: o produto descontinuado ficava sem opção). O histórico não se
  // perde: cada item de pedido guarda cópia de título, referência, tamanho e
  // preços, e o vínculo com o produto vira NULL sozinho (`on delete set null`
  // em pedido_itens) — o pedido passa a mostrar o item como "fora do
  // catálogo", sem link para a ficha.

  const { data: fotos } = await supabase
    .from("produto_imagens")
    .select("storage_path")
    .eq("produto_id", id);

  // Guardamos como era antes de sumir: depois do delete não há de onde tirar.
  const { data: antes } = await supabase
    .from("produtos")
    .select("titulo, modelo")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) return { erro: error.message };

  await supabase.from("log_atividades").insert({
    user_id: user.id,
    acao: "excluiu",
    entidade: "produto",
    entidade_id: String(id),
    detalhes: antes ? `${antes.modelo} — ${antes.titulo}` : null,
  });

  if (fotos?.length) {
    await criarClienteAdmin()
      .storage.from("produtos")
      .remove(fotos.map((f) => f.storage_path));
  }

  revalidar();
  redirect("/admin/produtos");
}

"use server";

import { configPublica } from "@/lib/catalogo";
import { enviarEmailsDePedido } from "@/lib/email";
import { criarClienteAdmin, criarClienteServidor } from "@/lib/supabase/server";

/**
 * Ações do pedido. Princípio único: O NAVEGADOR NUNCA DITA PREÇO.
 * Tudo que envolve valor é relido da view `precos_visiveis` com a sessão do
 * próprio cliente — visitante e cliente suspenso recebem zero linhas, e o
 * fechamento falha limpo.
 */

export type ChaveCarrinho = {
  produtoId: number;
  produtoTamanhoId: number | null;
};

type LinhaPreco = {
  precoKitAtacado: number;
  precoKitVarejo: number;
  pecasNoKit: number;
  tamanho: string | null;
};

function chave(c: ChaveCarrinho) {
  return `${c.produtoId}:${c.produtoTamanhoId ?? "unico"}`;
}

async function precosDaSessao(chaves: ChaveCarrinho[]) {
  const supabase = await criarClienteServidor();
  const ids = [...new Set(chaves.map((c) => c.produtoId))];
  if (!ids.length) return new Map<string, LinhaPreco>();

  const { data } = await supabase
    .from("precos_visiveis")
    .select(
      "produto_id, produto_tamanho_id, tamanho, pecas_no_kit, preco_kit_atacado, preco_kit_varejo",
    )
    .in("produto_id", ids);

  const mapa = new Map<string, LinhaPreco>();
  for (const l of data ?? []) {
    if (l.produto_id == null) continue;
    mapa.set(chave({ produtoId: l.produto_id, produtoTamanhoId: l.produto_tamanho_id }), {
      precoKitAtacado: Number(l.preco_kit_atacado ?? 0),
      precoKitVarejo: Number(l.preco_kit_varejo ?? 0),
      pecasNoKit: Number(l.pecas_no_kit ?? 1),
      tamanho: l.tamanho,
    });
  }
  return mapa;
}

/** Situação do carrinho para a tela: sessão, preços atuais e itens inválidos. */
export async function consultarCarrinho(chaves: ChaveCarrinho[]) {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let clienteAtivo = false;
  if (user) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("status, pode_ver_precos")
      .eq("user_id", user.id)
      .maybeSingle();
    clienteAtivo = cliente?.status === "ativo" && !!cliente.pode_ver_precos;
  }

  const [precos, config] = await Promise.all([
    precosDaSessao(chaves),
    configPublica(),
  ]);

  // Item cujo produto sumiu ou foi desativado precisa sair do carrinho.
  // Para quem vê preço, a própria view responde; para visitante, produtos.
  let existentes: Set<number>;
  if (clienteAtivo) {
    existentes = new Set(
      [...precos.keys()].map((c) => Number(c.split(":")[0])),
    );
  } else {
    const ids = [...new Set(chaves.map((c) => c.produtoId))];
    const { data } = ids.length
      ? await supabase.from("produtos").select("id").in("id", ids).eq("ativo", true)
      : { data: [] };
    existentes = new Set((data ?? []).map((p) => p.id));
  }

  return {
    logado: !!user,
    clienteAtivo,
    pedidoMinimo: config.pedidoMinimo,
    exibirVarejo: config.exibirVarejo,
    precos: Object.fromEntries(precos),
    indisponiveis: chaves.filter((c) => !existentes.has(c.produtoId)).map(chave),
  };
}

// ---------------------------------------------------------------- fechamento

export type ItemFechamento = ChaveCarrinho & { qtdKits: number };

export type ResultadoPedido =
  | { ok: true; numero: string }
  | { ok: false; erro: string };

export async function fecharPedido(
  itens: ItemFechamento[],
  observacoes: string,
): Promise<ResultadoPedido> {
  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para fechar o pedido." };

  // O RLS garante que só o próprio cadastro volta aqui.
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cliente || cliente.status !== "ativo" || !cliente.pode_ver_precos) {
    return {
      ok: false,
      erro: "Sua conta ainda não está liberada para compra. Fale com a nossa equipe.",
    };
  }

  const validos = itens.filter(
    (i) => Number.isInteger(i.qtdKits) && i.qtdKits > 0 && i.qtdKits <= 999,
  );
  if (!validos.length) return { ok: false, erro: "O pedido está vazio." };

  // Preço da VIEW, jamais do navegador. Item sem linha na view não existe mais
  // (produto desativado no meio do caminho) — o pedido não fecha às cegas.
  const precos = await precosDaSessao(validos);
  const semPreco = validos.filter((i) => !precos.get(chave(i)));
  if (semPreco.length) {
    return {
      ok: false,
      erro: "Um dos itens saiu do catálogo. Revise o pedido e tente de novo.",
    };
  }

  // Títulos e referências congelados no pedido, como manda o esquema.
  const idsProdutos = [...new Set(validos.map((i) => i.produtoId))];
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, titulo, modelo")
    .in("id", idsProdutos);
  const produtoPorId = new Map((produtos ?? []).map((p) => [p.id, p]));

  const totalAtacado = validos.reduce(
    (s, i) => s + i.qtdKits * precos.get(chave(i))!.precoKitAtacado,
    0,
  );

  const config = await configPublica();
  if (config.pedidoMinimo > 0 && totalAtacado < config.pedidoMinimo) {
    return {
      ok: false,
      erro: `O pedido mínimo é de R$ ${config.pedidoMinimo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Complete o carrinho para fechar.`,
    };
  }

  /*
   * A gravação usa o cliente admin: `pedidos` não tem política de SELECT para
   * cliente (decisão do §4 do PAINEL.md), então o insert com a sessão do
   * cliente não conseguiria devolver o id para gravar os itens. A sessão e o
   * vínculo já foram validados acima — o cliente_id vai daqui, não do form.
   */
  const admin = criarClienteAdmin();

  const { data: pedido, error: erroPedido } = await admin
    .from("pedidos")
    .insert({
      cliente_id: cliente.id,
      // O gatilho t_pedido_numero preenche o número (AAAAMM + sequencial)
      // quando chega null; o tipo gerado não enxerga gatilho, daí o cast.
      numero: null as unknown as string,
      observacoes_cliente: observacoes.trim().slice(0, 2000) || null,
      snapshot_cliente: {
        nome: cliente.nome,
        nome_fantasia: cliente.nome_fantasia,
        documento: cliente.documento,
        email: cliente.email,
        telefone1: cliente.telefone1,
        cep: cliente.cep,
        logradouro: cliente.logradouro,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        uf: cliente.uf,
      },
    })
    .select("id, numero")
    .single();

  if (erroPedido || !pedido) {
    console.error("[pedido] falha ao gravar:", erroPedido);
    return { ok: false, erro: "Não conseguimos fechar o pedido agora. Tente de novo." };
  }

  const linhas = validos.map((i) => {
    const preco = precos.get(chave(i))!;
    const produto = produtoPorId.get(i.produtoId);
    return {
      pedido_id: pedido.id,
      produto_id: i.produtoId,
      produto_tamanho_id: i.produtoTamanhoId,
      produto_titulo: produto?.titulo ?? "Produto",
      produto_modelo: produto?.modelo ?? "—",
      tamanho: preco.tamanho,
      pecas_no_kit: preco.pecasNoKit,
      qtd_kits: i.qtdKits,
      preco_kit_atacado: preco.precoKitAtacado,
      preco_kit_varejo: preco.precoKitVarejo,
    };
  });

  const { error: erroItens } = await admin.from("pedido_itens").insert(linhas);
  if (erroItens) {
    console.error("[pedido] falha nos itens, desfazendo:", erroItens);
    // sem os itens o pedido não vale — remove para não sujar o painel
    await admin.from("pedidos").delete().eq("id", pedido.id);
    return { ok: false, erro: "Não conseguimos fechar o pedido agora. Tente de novo." };
  }

  await admin.from("log_atividades").insert({
    user_id: user.id,
    acao: "pedido_criado",
    entidade: "pedidos",
    entidade_id: String(pedido.id),
    detalhes: { numero: pedido.numero, origem: "catalogo" },
  });

  // E-mails: para o cliente e para a casa. `emails_notificacao` não é chave
  // pública — daí o cliente admin. Falha de e-mail NÃO desfaz o pedido.
  const { data: configEmails } = await admin
    .from("configuracoes")
    .select("valor")
    .eq("chave", "emails_notificacao")
    .maybeSingle();
  const emailsDaCasa = Array.isArray(configEmails?.valor)
    ? (configEmails.valor as string[]).filter((e) => typeof e === "string" && e.includes("@"))
    : [];

  try {
    await enviarEmailsDePedido(
      {
        numero: pedido.numero,
        clienteNome: cliente.nome_fantasia || cliente.nome,
        clienteEmail: cliente.email,
        observacoes: observacoes.trim() || null,
        itens: linhas.map((l) => ({
          titulo: l.produto_titulo,
          modelo: l.produto_modelo,
          tamanho: l.tamanho,
          pecasNoKit: l.pecas_no_kit,
          qtdKits: l.qtd_kits,
          precoKit: l.preco_kit_atacado,
        })),
        totalAtacado,
        totalPecas: linhas.reduce((s, l) => s + l.pecas_no_kit * l.qtd_kits, 0),
      },
      emailsDaCasa,
    );
  } catch (e) {
    console.error("[pedido] e-mail falhou (pedido mantido):", e);
  }

  return { ok: true, numero: pedido.numero };
}

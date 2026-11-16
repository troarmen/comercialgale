import type { Metadata } from "next";
import Link from "next/link";
import { BotaoVoltar } from "@/components/voltar";
import { exigirAdminPagina } from "@/lib/sessao";
import { carregarListas, carregarProduto } from "../[id]/dados";
import { FormularioProduto, type DadosProduto } from "../[id]/formulario";

export const metadata: Metadata = { title: "Novo produto · Galé Comercial" };

const VAZIO: DadosProduto = {
  id: 0, titulo: "", modelo: "", descricao: null, tags: [],
  categoria_id: null, subcategoria_id: null, fabricante_id: null,
  kit_id: null, preco_atacado: 0, preco_varejo: 0,
  ncm: null, possui_st: false, ativo: true, lancamento: false,
};

/**
 * Cadastro de produto novo — em branco, ou já preenchido pelo "Duplicar"
 * (`?de=<id>`, pedido do cliente de nov/2026: produtos parecidos se cadastram
 * ajustando só o que muda).
 *
 * No duplicado vem TUDO do original, inclusive os preços (lidos da view
 * `precos_visiveis`, que o admin enxerga) e a grade com o preço próprio de
 * cada tamanho. Ficam de fora a referência — em branco e obrigatória, para
 * ninguém salvar dois produtos com a mesma sem perceber — e as fotos, que
 * só podem subir depois que o produto existe.
 */
export default async function PaginaNovoProduto({
  searchParams,
}: {
  searchParams: Promise<{ de?: string | string[] }>;
}) {
  const { de } = await searchParams;
  const idOrigem = Number(Array.isArray(de) ? de[0] : de);

  // O layout da seção já barra quem não é admin; repetir aqui é de graça
  // (a consulta do perfil é a mesma da requisição) e protege os preços do
  // original mesmo se a página for reaproveitada em outro lugar.
  await exigirAdminPagina();
  const origem = idOrigem ? await carregarProduto(idOrigem) : null;
  const listas = origem?.listas ?? (await carregarListas());

  return (
    <div className="px-8 py-7">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <BotaoVoltar chave="produtos" padrao="/admin/produtos" rotulo="Voltar para produtos" />
        <nav className="text-sm text-suave">
          <Link href="/admin/produtos" className="transition hover:text-texto">
            Produtos
          </Link>
          <span className="px-1.5 text-tenue">/</span>
          {origem && (
            <>
              <Link
                href={`/admin/produtos/${origem.p.id}`}
                className="transition hover:text-texto"
              >
                {origem.p.titulo}
              </Link>
              <span className="px-1.5 text-tenue">/</span>
            </>
          )}
          <span className="text-texto">{origem ? "Duplicar" : "Novo"}</span>
        </nav>
      </div>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          {origem ? "Novo produto (cópia)" : "Novo produto"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          {origem ? (
            <>
              Todos os campos vieram da ref. {origem.p.modelo}. Informe a nova
              referência, ajuste o que muda e cadastre. As fotos não são
              copiadas: você as adiciona na ficha do produto novo, logo depois
              de salvar.
            </>
          ) : (
            "Depois de salvar você volta para a ficha do produto, onde adiciona as fotos."
          )}
        </p>
      </header>

      {idOrigem > 0 && !origem && (
        <p className="mb-4 max-w-4xl rounded-lg border border-borda bg-superficie-2 px-3.5 py-2.5 text-sm text-suave">
          O produto que seria duplicado não foi encontrado (talvez tenha sido
          excluído). O formulário abaixo está em branco.
        </p>
      )}

      <div className="max-w-4xl">
        <FormularioProduto
          key={origem ? `copia-${origem.p.id}` : "novo"}
          p={origem ? { ...origem.p, id: 0, modelo: "" } : VAZIO}
          listas={listas}
          grade={origem?.grade ?? []}
          rotulo="Cadastrar produto"
          duplicadoDe={origem ? { id: origem.p.id, modelo: origem.p.modelo } : undefined}
        />
      </div>
    </div>
  );
}

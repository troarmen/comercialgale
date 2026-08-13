import type { Metadata } from "next";
import Link from "next/link";
import { carregarListas } from "../[id]/page";
import { FormularioProduto } from "../[id]/formulario";

export const metadata: Metadata = { title: "Novo produto · Galé Comercial" };

export default async function PaginaNovoProduto() {
  const listas = await carregarListas();

  return (
    <div className="px-8 py-7">
      <nav className="mb-3 text-sm text-suave">
        <Link href="/admin/produtos" className="transition hover:text-texto">
          Produtos
        </Link>
        <span className="px-1.5 text-tenue">/</span>
        <span className="text-texto">Novo</span>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-texto">
          Novo produto
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          Depois de salvar você volta para a ficha do produto, onde adiciona as
          fotos.
        </p>
      </header>

      <div className="max-w-4xl">
        <FormularioProduto
          p={{
            id: 0, titulo: "", modelo: "", descricao: null, tags: [],
            categoria_id: null, subcategoria_id: null, fabricante_id: null,
            kit_id: null, preco_atacado: 0, preco_varejo: 0,
            ncm: null, possui_st: false, ativo: true, lancamento: false,
          }}
          listas={listas}
          grade={[]}
          rotulo="Cadastrar produto"
        />
      </div>
    </div>
  );
}

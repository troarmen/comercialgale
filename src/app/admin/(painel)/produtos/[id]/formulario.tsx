"use client";

import { useState } from "react";
import { Aviso, BotaoSalvar, CAMPO, Interruptor, useEnvio } from "@/components/cadastro-ui";
import { reais } from "@/lib/formato";
import { salvarProduto, type EstadoProduto } from "./acoes";
import { EditorDescricao } from "./descricao";
import { Grade, type LinhaGrade, type OpcaoTamanho } from "./grade";

export type DadosProduto = {
  id: number;
  titulo: string;
  modelo: string;
  descricao: string | null;
  tags: string[];
  categoria_id: number | null;
  subcategoria_id: number | null;
  fabricante_id: number | null;
  kit_id: number | null;
  preco_atacado: number;
  preco_varejo: number;
  ncm: string | null;
  possui_st: boolean;
  ativo: boolean;
  lancamento: boolean;
};

/**
 * Opções dos <select>. Vêm só os itens ativos MAIS os que este produto já
 * usa (ver `carregarListas`), e por isso cada um traz o próprio `ativo`.
 */
export type Listas = {
  categorias: { id: number; nome: string; ativo: boolean }[];
  subcategorias: { id: number; nome: string; categoria_id: number; ativo: boolean }[];
  fabricantes: { id: number; nome: string; ativo: boolean }[];
  kits: { id: number; pecas: number; ativo: boolean }[];
  tamanhos: OpcaoTamanho[];
};

/** "Linha Praia (inativa)" — o item aparece, mas avisando. */
function rotuloOpcao(nome: string, ativo: boolean, genero: "a" | "o" = "a") {
  return ativo ? nome : `${nome} (inativ${genero})`;
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-5">
      <h2 className="text-sm font-semibold text-texto">{titulo}</h2>
      {descricao && (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-suave">
          {descricao}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FormularioProduto({
  p,
  listas,
  grade,
  rotulo = "Salvar produto",
  duplicadoDe,
}: {
  p: DadosProduto;
  listas: Listas;
  grade: LinhaGrade[];
  rotulo?: string;
  /** Cadastro aberto pelo "Duplicar": de qual produto vieram os campos. */
  duplicadoDe?: { id: number; modelo: string };
}) {
  // Sem `<form action>`: o reset automático do React 19 voltava Categoria e
  // Kit para "Escolha…" depois de salvar (ver useEnvio).
  const [estado, aoEnviar, salvando] = useEnvio<EstadoProduto>(salvarProduto, {});

  const [categoria, setCategoria] = useState(p.categoria_id ?? 0);
  const [kitId, setKitId] = useState(p.kit_id ?? 0);
  const [atacado, setAtacado] = useState(
    p.preco_atacado ? p.preco_atacado.toFixed(2).replace(".", ",") : "",
  );
  const [varejo, setVarejo] = useState(
    p.preco_varejo ? p.preco_varejo.toFixed(2).replace(".", ",") : "",
  );

  const pecas = listas.kits.find((k) => k.id === kitId)?.pecas ?? 0;
  const numero = (v: string) => {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const unitAtacado = pecas ? numero(atacado) / pecas : 0;
  const unitVarejo = pecas ? numero(varejo) / pecas : 0;
  const margem =
    numero(atacado) > 0 && numero(varejo) > 0
      ? ((numero(varejo) - numero(atacado)) / numero(atacado)) * 100
      : null;

  const subsVisiveis = listas.subcategorias.filter(
    (s) => s.categoria_id === categoria,
  );

  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      {p.id > 0 && <input type="hidden" name="id" value={p.id} />}
      {duplicadoDe && (
        <input type="hidden" name="duplicado_de" value={duplicadoDe.id} />
      )}

      <Secao titulo="Identificação">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-texto">Nome do produto</span>
            <input
              name="titulo"
              defaultValue={p.titulo}
              required
              maxLength={160}
              placeholder="Ex: Cueca Slip Adulto"
              className={CAMPO}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Referência</span>
            <input
              name="modelo"
              defaultValue={p.modelo}
              required
              maxLength={60}
              placeholder="Ex: 8005"
              aria-describedby={duplicadoDe ? "aviso-referencia" : undefined}
              className={CAMPO}
            />
            {duplicadoDe && (
              <span id="aviso-referencia" className="text-xs font-medium text-alerta-texto">
                Duplicado de ref. {duplicadoDe.modelo} — informe a nova referência.
              </span>
            )}
          </label>

          <div className="sm:col-span-3">
            <EditorDescricao inicial={p.descricao ?? ""} />
          </div>

          <label className="flex flex-col gap-1.5 sm:col-span-3">
            <span className="text-sm font-medium text-texto">
              Palavras de busca
            </span>
            <input
              name="tags"
              defaultValue={p.tags.join(", ")}
              placeholder="cueca, slip, masculino, moda íntima"
              className={CAMPO}
            />
            <span className="text-xs text-tenue">
              Separadas por vírgula. Ajudam o cliente a encontrar o produto
              mesmo escrevendo diferente do nome.
            </span>
          </label>
        </div>
      </Secao>

      <Secao titulo="Classificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Categoria</span>
            <select
              name="categoria_id"
              value={categoria || ""}
              onChange={(e) => setCategoria(Number(e.target.value))}
              required
              className={CAMPO}
            >
              <option value="">Escolha…</option>
              {listas.categorias.map((c) => (
                <option key={c.id} value={c.id}>{rotuloOpcao(c.nome, c.ativo)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Subcategoria</span>
            <select
              name="subcategoria_id"
              defaultValue={p.subcategoria_id ?? ""}
              key={categoria}
              className={CAMPO}
              disabled={!categoria}
            >
              <option value="">Nenhuma</option>
              {subsVisiveis.map((s) => (
                <option key={s.id} value={s.id}>{rotuloOpcao(s.nome, s.ativo)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Fabricante</span>
            <select
              name="fabricante_id"
              defaultValue={p.fabricante_id ?? ""}
              className={CAMPO}
            >
              <option value="">Nenhum</option>
              {listas.fabricantes.map((f) => (
                <option key={f.id} value={f.id}>{rotuloOpcao(f.nome, f.ativo, "o")}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">Kit</span>
            <select
              name="kit_id"
              value={kitId || ""}
              onChange={(e) => setKitId(Number(e.target.value))}
              required
              className={CAMPO}
            >
              <option value="">Escolha…</option>
              {listas.kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {rotuloOpcao(`${k.pecas} ${k.pecas === 1 ? "peça" : "peças"}`, k.ativo, "o")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Secao>

      <Secao
        titulo="Preços"
        descricao="Informe o valor do KIT fechado. O preço por peça é calculado automaticamente e é ele que o cliente vê no catálogo."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">
              Atacado — o que o lojista paga
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-suave">
                R$
              </span>
              <input
                name="preco_atacado"
                value={atacado}
                onChange={(e) => setAtacado(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={`${CAMPO} pl-9 tabular-nums`}
              />
            </div>
            {pecas > 0 && numero(atacado) > 0 && (
              <span className="text-xs text-suave">
                {reais(unitAtacado)} por peça ({pecas} no kit)
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-texto">
              Varejo — revenda sugerida
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-suave">
                R$
              </span>
              <input
                name="preco_varejo"
                value={varejo}
                onChange={(e) => setVarejo(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className={`${CAMPO} pl-9 tabular-nums`}
              />
            </div>
            {pecas > 0 && numero(varejo) > 0 && (
              <span className="text-xs text-suave">
                {reais(unitVarejo)} por peça
                {margem !== null && ` · margem de ${margem.toFixed(0)}%`}
              </span>
            )}
          </label>
        </div>

        {!pecas && (
          <p className="mt-3 text-xs text-alerta-texto">
            Escolha o kit acima para ver o preço por peça.
          </p>
        )}
      </Secao>

      <Grade
        tamanhos={listas.tamanhos}
        inicial={grade}
        precoKitAtacado={numero(atacado)}
        pecasNoKit={pecas}
      />

      <Secao titulo="Publicação">
        <div className="space-y-4">
          <Interruptor nome="ativo" marcado={p.ativo} rotulo="Aparece no catálogo" />
          <Interruptor
            nome="lancamento"
            marcado={p.lancamento}
            rotulo="Marcar como lançamento"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-texto">NCM</span>
              <input
                name="ncm"
                defaultValue={p.ncm ?? ""}
                placeholder="Opcional"
                className={CAMPO}
              />
            </label>
            <div className="flex items-end pb-2.5">
              <Interruptor
                nome="possui_st"
                marcado={p.possui_st}
                rotulo="Tem substituição tributária"
              />
            </div>
          </div>
        </div>
      </Secao>

      {duplicadoDe && (
        <p className="rounded-lg border border-borda bg-superficie-2 px-3.5 py-2.5 text-sm text-suave">
          As fotos não são copiadas. Depois de cadastrar, você cai na ficha do
          produto novo e adiciona as fotos dele lá.
        </p>
      )}

      {estado.erro && <Aviso mensagem={estado.erro} />}

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-borda bg-fundo/95 px-1 py-3 backdrop-blur">
        <BotaoSalvar rotulo={rotulo} salvando={salvando} />
        {estado.ok && (
          <span role="status" className="text-sm font-medium text-ok-texto">
            Salvo.
          </span>
        )}
      </div>
    </form>
  );
}

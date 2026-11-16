"use client";

import {
  createContext,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { definirLancamento } from "./acoes-lista";

/**
 * Coluna "Lançamento" e seleção em lote da lista de produtos (pedido do
 * cliente, nov/2026).
 *
 * A tabela continua sendo desenhada no servidor; daqui vêm só as caixas de
 * marcar e a barra de ações, ligadas por um contexto. Por quê: a linha inteira
 * (foto, preço, categoria) não precisa de JavaScript — só o que o Arthur
 * clica.
 *
 * Atualização otimista com `useOptimistic`: a caixa muda na hora do clique e o
 * valor "de mentira" vale enquanto a action roda. Deu certo, a action
 * revalida a página e o servidor manda o valor novo de verdade na mesma
 * resposta. Deu errado, a action termina sem revalidar e o React descarta o
 * valor otimista sozinho — a caixa volta para o que estava, com o aviso.
 */

type Aviso = { tipo: "ok" | "erro"; texto: string };

type Contexto = {
  ids: number[];
  selecionados: ReadonlySet<number>;
  alternar: (id: number) => void;
  marcarTodos: (marcar: boolean) => void;
  limpar: () => void;
  /** Valor exibido: o otimista, se houver gravação em andamento. */
  valor: (id: number, doServidor: boolean) => boolean;
  gravando: (id: number) => boolean;
  gravar: (ids: number[], lancamento: boolean) => void;
  pendente: boolean;
  aviso: Aviso | null;
};

const ContextoLote = createContext<Contexto | null>(null);

function useLote() {
  const c = useContext(ContextoLote);
  if (!c) throw new Error("Use dentro de <ListaComLote>.");
  return c;
}

const plural = (n: number) =>
  n === 1 ? "1 produto" : `${n.toLocaleString("pt-BR")} produtos`;

const NENHUM: ReadonlySet<number> = new Set();

/**
 * Envolve a tabela. `ids` são os produtos DESTA página: "selecionar todos"
 * vale só para eles, de propósito — marcar em massa o que não está na tela
 * seria fácil de fazer sem querer.
 */
export function ListaComLote({
  ids,
  children,
}: {
  ids: number[];
  children: React.ReactNode;
}) {
  // A seleção vale para a página em que foi feita. Trocou a página, o filtro
  // ou a ordem (outros ids na tela), ela some sozinha. Não dá para resolver
  // com `key` no componente: remontar apagaria também o aviso "7 produtos
  // marcados", justo quando a lista filtrada fica vazia depois da ação.
  const chave = ids.join(",");
  const [selecao, setSelecao] = useState(() => ({ chave, ids: NENHUM }));
  const selecionados = selecao.chave === chave ? selecao.ids : NENHUM;
  const mudarSelecao = (novo: (atual: ReadonlySet<number>) => ReadonlySet<number>) =>
    setSelecao((s) => ({ chave, ids: novo(s.chave === chave ? s.ids : NENHUM) }));

  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Confirmação some sozinha; erro fica até a próxima ação.
  useEffect(() => {
    if (aviso?.tipo !== "ok") return;
    const t = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(t);
  }, [aviso]);

  const [pendente, iniciar] = useTransition();
  const [otimista, sobrepor] = useOptimistic(
    new Map<number, boolean>(),
    (atual, mudanca: { ids: number[]; lancamento: boolean }) => {
      const novo = new Map(atual);
      for (const id of mudanca.ids) novo.set(id, mudanca.lancamento);
      return novo;
    },
  );

  function gravar(alvo: number[], lancamento: boolean) {
    if (!alvo.length) return;
    setAviso(null);
    const emLote = alvo.length > 1;
    iniciar(async () => {
      sobrepor({ ids: alvo, lancamento });
      try {
        const r = await definirLancamento(alvo, lancamento);
        if (r.erro) {
          setAviso({ tipo: "erro", texto: r.erro });
          return;
        }
        if (emLote) {
          mudarSelecao(() => NENHUM);
          const n = r.alterados ?? 0;
          setAviso({
            tipo: "ok",
            texto:
              n === 0
                ? "Nada mudou: os selecionados já estavam assim."
                : lancamento
                  ? `${plural(n)} ${n === 1 ? "marcado" : "marcados"} como lançamento.`
                  : `${plural(n)} ${n === 1 ? "saiu" : "saíram"} de lançamento.`,
          });
        }
      } catch {
        // Queda de rede ou servidor fora: a action nem respondeu.
        setAviso({
          tipo: "erro",
          texto: "Não foi possível salvar. Confira a conexão e tente de novo.",
        });
      }
    });
  }

  const contexto: Contexto = {
    ids,
    selecionados,
    alternar: (id) =>
      mudarSelecao((atual) => {
        const novo = new Set(atual);
        if (novo.has(id)) novo.delete(id);
        else novo.add(id);
        return novo;
      }),
    marcarTodos: (marcar) => mudarSelecao(() => (marcar ? new Set(ids) : NENHUM)),
    limpar: () => mudarSelecao(() => NENHUM),
    valor: (id, doServidor) => otimista.get(id) ?? doServidor,
    gravando: (id) => otimista.has(id),
    gravar,
    pendente,
    aviso,
  };

  return <ContextoLote.Provider value={contexto}>{children}</ContextoLote.Provider>;
}

const CAIXA = "h-4 w-4 cursor-pointer accent-acento align-middle disabled:cursor-wait";

/** Caixa do cabeçalho: marca ou desmarca todos desta página. */
export function MarcarTodos() {
  const { ids, selecionados, marcarTodos } = useLote();
  const ref = useRef<HTMLInputElement>(null);
  const todos = ids.length > 0 && ids.every((id) => selecionados.has(id));
  const alguns = !todos && ids.some((id) => selecionados.has(id));

  // "indeterminado" só existe como propriedade do DOM, não como atributo
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = alguns;
  }, [alguns]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={todos}
      onChange={(e) => marcarTodos(e.target.checked)}
      aria-label="Selecionar todos os produtos desta página"
      title="Selecionar todos desta página"
      className={CAIXA}
    />
  );
}

/** Caixa de seleção da linha (para as ações em lote). */
export function MarcarLinha({ id, titulo }: { id: number; titulo: string }) {
  const { selecionados, alternar } = useLote();
  return (
    <input
      type="checkbox"
      data-selecao=""
      checked={selecionados.has(id)}
      onChange={() => alternar(id)}
      aria-label={`Selecionar ${titulo}`}
      className={CAIXA}
    />
  );
}

/** Coluna "Lançamento": grava na hora do clique. */
export function CaixaLancamento({
  id,
  marcado,
  titulo,
}: {
  id: number;
  marcado: boolean;
  titulo: string;
}) {
  const { valor, gravando, gravar } = useLote();
  const atual = valor(id, marcado);
  const salvando = gravando(id);
  return (
    <label
      className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-superficie ${
        salvando ? "opacity-60" : ""
      }`}
      title={atual ? "Tirar de lançamento" : "Marcar como lançamento"}
    >
      <input
        type="checkbox"
        checked={atual}
        // Enquanto grava, um segundo clique viraria uma segunda gravação na
        // fila com o valor invertido; esperar o primeiro é mais previsível.
        disabled={salvando}
        aria-busy={salvando || undefined}
        onChange={(e) => gravar([id], e.target.checked)}
        aria-label={`Lançamento: ${titulo}`}
        className={CAIXA}
      />
    </label>
  );
}

/**
 * Barra das ações em lote. Fica grudada no topo da tela enquanto se rola a
 * página, para o botão estar à mão depois de marcar a última linha. Mora FORA
 * do cartão da tabela: o `overflow-hidden` do cartão vira o contêiner do
 * `sticky`, e a barra não grudaria em nada.
 */
export function BarraLote() {
  const { ids, selecionados, gravar, limpar, pendente, aviso } = useLote();
  const n = selecionados.size;
  const alvo = [...selecionados];

  // Lista vazia: a barra só fica se tiver o que contar — por exemplo, depois
  // de tirar de lançamento tudo o que o filtro "só lançamentos" mostrava.
  if (!ids.length && !aviso && !pendente) return null;

  const botao =
    "h-8 rounded-lg border border-borda bg-superficie px-3 text-sm font-medium text-texto transition hover:bg-superficie-2 disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="sticky top-2 z-10 mb-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-borda bg-superficie px-4 py-2 shadow-pousada">
      {n === 0 ? (
        ids.length > 0 && <p className="text-sm text-suave">
          Marque produtos na primeira coluna para pôr ou tirar de lançamento de
          uma vez.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-texto">
            {plural(n)} {n === 1 ? "selecionado" : "selecionados"}
          </p>
          <button
            type="button"
            disabled={pendente}
            onClick={() => gravar(alvo, true)}
            className={botao}
          >
            Marcar como lançamento
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={() => gravar(alvo, false)}
            className={botao}
          >
            Tirar de lançamento
          </button>
          <button
            type="button"
            onClick={limpar}
            className="h-8 rounded-lg px-3 text-sm text-suave transition hover:bg-superficie-2 hover:text-texto"
          >
            Limpar seleção
          </button>
        </>
      )}

      <p
        aria-live="polite"
        className={`ml-auto text-sm ${
          aviso?.tipo === "erro" ? "text-acento-texto" : "text-ok-texto"
        }`}
      >
        {pendente ? <span className="text-suave">Salvando…</span> : aviso?.texto}
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/**
 * "Voltar para a lista" com memória (pedido do cliente, nov/2026).
 *
 * O problema: abrir um produto pela lista filtrada, editar e salvar deixava o
 * Arthur sem caminho de volta — o link "Produtos" do topo abria a lista do
 * zero, sem a busca, sem a página e no topo da tela.
 *
 * Como funciona, em duas peças:
 *   • <LembrarLista chave="produtos" /> fica na página da LISTA. Guarda no
 *     sessionStorage o endereço completo (com busca, filtros e página) e a
 *     posição da rolagem. Quando a lista abre de novo vinda do Voltar, devolve
 *     a rolagem para onde estava.
 *   • <BotaoVoltar chave="produtos" padrao="/admin/produtos" /> fica na tela
 *     de edição. Aponta para o endereço guardado — ou para `padrao`, se a
 *     pessoa chegou por outro caminho (link direto, aba nova).
 *
 * Por que sessionStorage e não `history.back()`: salvar com Server Action não
 * cria entrada no histórico, mas cadastrar um produto novo redireciona — e
 * aí o "voltar" do navegador levaria ao formulário vazio. O endereço guardado
 * funciona nos dois casos e é por aba, então duas abas com buscas diferentes
 * não se atrapalham.
 */

const chaveEndereco = (chave: string) => `gale:lista:${chave}`;
const chaveRolagem = (chave: string) => `gale:lista:${chave}:rolagem`;
const chaveVoltando = (chave: string) => `gale:lista:${chave}:voltando`;

function ler(chave: string) {
  try {
    return window.sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) window.sessionStorage.removeItem(chave);
    else window.sessionStorage.setItem(chave, valor);
  } catch {
    // aba anônima com storage bloqueado: o Voltar cai no endereço padrão
  }
}

/** Coloque na página da lista. Não desenha nada. */
export function LembrarLista({ chave }: { chave: string }) {
  const caminho = usePathname();
  const params = useSearchParams();
  const endereco = params.toString() ? `${caminho}?${params}` : caminho;

  useEffect(() => {
    gravar(chaveEndereco(chave), endereco);

    // Veio do Voltar para este mesmo endereço? Devolve a rolagem.
    const voltando = ler(chaveVoltando(chave));
    gravar(chaveVoltando(chave), null);
    if (voltando === endereco) {
      const y = Number(ler(chaveRolagem(chave)));
      if (Number.isFinite(y) && y > 0) {
        // espera a tabela pintar antes de rolar
        requestAnimationFrame(() => window.scrollTo({ top: y }));
      }
    }

    // Ao abrir uma ficha, o Next troca a página e a leva ao topo ANTES de esta
    // lista desmontar e soltar o ouvinte: sem esta conferência, aquele último
    // "rolou para 0" sobrescrevia a posição verdadeira e o Voltar caía no
    // topo (visto no teste: rolagem 569 guardada como 0). O endereço já é o
    // da ficha nesse momento, então só grava enquanto a URL for a da lista.
    const aindaNaLista = () => {
      const aqui = new URLSearchParams(window.location.search).toString();
      return (aqui ? `${window.location.pathname}?${aqui}` : window.location.pathname) === endereco;
    };

    // A conferência de URL acima não basta em produção: no teste integrado
    // (nov/2026) o "rolou para 0" da troca de página ainda chegava com a URL
    // da lista e a posição 500 virava 0. Por isso o clique que SAI da lista
    // (fase de captura, antes do Next agir) fotografa a posição e congela a
    // gravação até a lista desmontar.
    let saindo = false;
    const aoClicar = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      gravar(chaveRolagem(chave), String(Math.round(window.scrollY)));
      saindo = true;
    };

    let quadro = 0;
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        if (!saindo && aindaNaLista()) {
          gravar(chaveRolagem(chave), String(Math.round(window.scrollY)));
        }
      });
    };
    // Voltar do navegador para a própria lista (filtro, paginação) reabre a
    // gravação: o efeito só roda de novo se o endereço mudar.
    const aoVoltarDoHistorico = () => {
      saindo = false;
    };
    document.addEventListener("click", aoClicar, { capture: true });
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("popstate", aoVoltarDoHistorico);
    return () => {
      cancelAnimationFrame(quadro);
      document.removeEventListener("click", aoClicar, { capture: true });
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("popstate", aoVoltarDoHistorico);
    };
  }, [chave, endereco]);

  return null;
}

const nadaParaAssinar = () => () => {};

/** Botão/link de volta para a lista, como ela estava. */
export function BotaoVoltar({
  chave,
  padrao,
  destino,
  rotulo = "Voltar",
  className,
}: {
  chave: string;
  padrao: string;
  /**
   * Endereço fixo de volta, quando a tela sabe de onde a pessoa veio (ex.:
   * pedido aberto pela ficha do cliente). Ignora a lista guardada.
   */
  destino?: string;
  rotulo?: string;
  className?: string;
}) {
  // No servidor (e na hidratação) vale o `padrao`; no navegador, o endereço
  // guardado pela lista. useSyncExternalStore faz essa troca sem erro de
  // hidratação. O sessionStorage não avisa mudança na própria aba, então a
  // assinatura é vazia: o valor é relido a cada render.
  const guardado = useSyncExternalStore(
    nadaParaAssinar,
    () => ler(chaveEndereco(chave)),
    () => null,
  );
  // só aceita endereço da mesma seção — nunca um link externo
  const daLista = guardado && guardado.startsWith(padrao) ? guardado : padrao;
  const href = destino ?? daLista;

  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => {
        // só a lista devolve a rolagem; a outra tela abre do topo
        if (!destino) gravar(chaveVoltando(chave), href);
      }}
      className={
        className ??
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 text-sm font-medium text-texto transition hover:bg-superficie-2"
      }
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M11.5 5 6.5 10l5 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {rotulo}
    </Link>
  );
}

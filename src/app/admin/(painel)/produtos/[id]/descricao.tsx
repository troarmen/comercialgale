"use client";

import { useRef, useState } from "react";
import { CAMPO } from "@/components/cadastro-ui";
import { alternarNegrito, DescricaoFormatada } from "@/lib/descricao";

/**
 * Campo de descrição com botão de negrito e prévia da loja.
 *
 * O texto continua sendo um <textarea> comum: o negrito é gravado como
 * **assim** (ver src/lib/descricao.tsx). O botão só poupa o Arthur de digitar
 * os asteriscos, e a prévia logo abaixo mostra exatamente o que o lojista vai
 * ver na ficha do produto.
 */
export function EditorDescricao({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const campo = useRef<HTMLTextAreaElement>(null);

  function negrito() {
    const ta = campo.current;
    if (!ta) return;
    const troca = alternarNegrito(ta.value, ta.selectionStart, ta.selectionEnd);
    ta.focus();
    ta.setSelectionRange(troca.inicio, troca.fim);
    // insertText mantém o Ctrl+Z do navegador funcionando e dispara o
    // onChange normal. Se o navegador não aceitar, troca o valor direto.
    const foi =
      troca.inicio !== troca.fim || troca.trecho
        ? document.execCommand("insertText", false, troca.trecho)
        : true;
    if (!foi) {
      const novo = ta.value.slice(0, troca.inicio) + troca.trecho + ta.value.slice(troca.fim);
      ta.value = novo;
      setTexto(novo);
    }
    ta.setSelectionRange(troca.selInicio, troca.selFim);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor="campo-descricao" className="text-sm font-medium text-texto">
          Descrição
        </label>
        <div role="toolbar" aria-label="Formatação da descrição" className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault() /* não tira a seleção do texto */}
            onClick={negrito}
            title="Negrito (Ctrl+B ou ⌘+B)"
            aria-label="Negrito"
            aria-keyshortcuts="Control+B Meta+B"
            className="flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md border border-borda bg-superficie px-2.5 text-sm text-texto transition hover:bg-superficie-2"
          >
            <span className="font-bold">B</span>
            <span className="text-xs text-suave">Negrito</span>
          </button>
        </div>
      </div>
      <textarea
        ref={campo}
        id="campo-descricao"
        name="descricao"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b") {
            e.preventDefault();
            negrito();
          }
        }}
        rows={5}
        placeholder="Composição, caimento, detalhes que ajudem o lojista a decidir."
        className={`${CAMPO} h-auto py-2.5 leading-relaxed`}
      />
      <span className="text-xs text-tenue">
        Selecione um trecho e use o botão Negrito (ou Ctrl+B / ⌘+B). No texto o
        negrito aparece entre **asteriscos**; na loja, só o destaque. Linha em
        branco separa parágrafos.
      </span>

      {texto.trim() && (
        <div className="mt-2 rounded-lg border border-dashed border-borda bg-superficie-2 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-tenue">
            Prévia na loja
          </p>
          <DescricaoFormatada
            texto={texto}
            className="space-y-3 text-sm leading-relaxed text-suave"
          />
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CONTATO } from "@/lib/contato";
import { linkWhatsApp } from "@/lib/seo";
import { sair } from "./acoes";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-borda py-2.5 last:border-0">
      <dt className="text-sm text-suave">{rotulo}</dt>
      <dd className="text-sm font-medium text-texto">{valor}</dd>
    </div>
  );
}

export default async function PaginaConta() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?destino=/conta");

  // O RLS devolve apenas o próprio cadastro.
  const { data: cliente } = await supabase
    .from("clientes")
    .select(
      "nome, nome_fantasia, documento, email, telefone1, cep, logradouro, numero, complemento, bairro, cidade, uf, status, pode_ver_precos",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cliente) redirect("/admin");

  const ativo = cliente.status === "ativo";
  const endereco = [
    [cliente.logradouro, cliente.numero].filter(Boolean).join(", "),
    cliente.complemento,
    cliente.bairro,
    [cliente.cidade, cliente.uf].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-texto">
        Minha conta
      </h1>
      <p className="mt-1 text-sm text-suave">
        Os dados que a Galé usa para faturar e enviar os seus pedidos.
      </p>

      {!ativo && (
        <p className="mt-5 rounded-xl bg-alerta-fundo px-4 py-3 text-sm font-medium leading-relaxed text-alerta-texto">
          Seu cadastro ainda não está liberado para compra. Nossa equipe entra
          em contato — se preferir, chame no WhatsApp {CONTATO.whatsapp}.
        </p>
      )}
      {ativo && !cliente.pode_ver_precos && (
        <p className="mt-5 rounded-xl bg-alerta-fundo px-4 py-3 text-sm font-medium leading-relaxed text-alerta-texto">
          A exibição de preços está suspensa para a sua conta no momento. Fale
          com a nossa equipe para regularizar.
        </p>
      )}

      <dl className="mt-6 rounded-2xl border border-borda/60 bg-superficie px-5 py-2 shadow-pousada">
        <Linha rotulo="Razão social / nome" valor={cliente.nome} />
        <Linha rotulo="Nome fantasia" valor={cliente.nome_fantasia} />
        <Linha rotulo="CNPJ / CPF" valor={cliente.documento} />
        <Linha rotulo="E-mail" valor={cliente.email} />
        <Linha rotulo="Telefone" valor={cliente.telefone1} />
        <Linha rotulo="Endereço" valor={endereco || null} />
        <Linha rotulo="CEP" valor={cliente.cep} />
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-suave">
        Algum dado desatualizado? Avise a equipe pelo{" "}
        <a
          href={linkWhatsApp("Olá! Preciso atualizar os dados do meu cadastro.")}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-acento-texto"
        >
          WhatsApp
        </a>{" "}
        que a gente corrige.
      </p>

      <div className="mt-6 rounded-2xl border border-borda/60 bg-superficie p-5 shadow-pousada">
        <h2 className="text-sm font-semibold text-texto">Seus pedidos</h2>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          Cada pedido fechado é confirmado por e-mail e acompanhado diretamente
          com a nossa equipe — pagamento, separação e envio são combinados no
          contato, não pelo site.
        </p>
      </div>

      <form action={sair} className="mt-8">
        <button
          type="submit"
          className="h-10 rounded-full border border-borda px-5 text-sm font-semibold text-suave transition hover:border-borda-forte hover:text-texto"
        >
          Sair da conta
        </button>
      </form>
    </div>
  );
}

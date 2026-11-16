import type { Metadata } from "next";
import Link from "next/link";
import { configPublica, sessaoCatalogo } from "@/lib/catalogo";
import { reais } from "@/lib/formato";
import { FormularioCadastro } from "./formulario";
import { aprovacaoAutomatica, carimboDoFormulario } from "./servidor";

export const metadata: Metadata = {
  title: "Cadastro de Lojista — Compre no Atacado",
  description:
    "Cadastre a sua loja na Comercial Galé e compre lingerie, meias, cuecas e pijamas no atacado. Cadastro gratuito, com login e senha criados na hora.",
  alternates: { canonical: "/cadastro" },
};

export default async function PaginaCadastro() {
  const [config, { ligada: automatico }, { user }] = await Promise.all([
    configPublica(),
    aprovacaoAutomatica(),
    sessaoCatalogo(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight text-texto">
          Cadastre a sua loja
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-suave">
          O catálogo é aberto; o preço de atacado é para lojistas cadastrados.
          {automatico
            ? " Preencha os dados, crie a sua senha e veja os preços na hora"
            : " Preencha os dados e crie a sua senha: os preços aparecem assim que a nossa equipe liberar a sua loja"}
          {config.pedidoMinimo > 0 &&
            ` — compras no atacado a partir de ${reais(config.pedidoMinimo)}`}
          . Já tem login?{" "}
          <Link href="/entrar" className="font-semibold text-acento-texto">
            Entre por aqui
          </Link>
          .
        </p>
      </header>

      <div className="relative mt-7">
        {user ? (
          // Cadastrar daqui trocaria a sessão de quem já entrou (a action
          // também recusa; isto só poupa a pessoa de preencher à toa).
          <div className="rounded-2xl border border-borda/60 bg-superficie p-6 text-sm leading-relaxed text-suave shadow-suave sm:p-8">
            Há uma conta aberta neste navegador. Para cadastrar outra loja,
            saia dela primeiro em{" "}
            <Link href="/conta" className="font-semibold text-acento-texto">
              Minha conta
            </Link>
            .
          </div>
        ) : (
          <FormularioCadastro carimbo={carimboDoFormulario()} automatico={automatico} />
        )}
      </div>
    </div>
  );
}

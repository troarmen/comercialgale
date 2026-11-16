import { exigirAdminPagina } from "@/lib/sessao";

// Seção só de admin: o colaborador é mandado de volta para Pedidos.
export default async function LayoutSoAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirAdminPagina();
  return children;
}

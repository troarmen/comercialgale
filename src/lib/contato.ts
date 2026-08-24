/**
 * Dados de contato da Galé, exatamente como no site atual.
 * Um lugar só: rodapé, página de contato, WhatsApp e dados estruturados
 * leem daqui.
 */
export const CONTATO = {
  razao: "Comercial Galé de Confecções Ltda.",
  nome: "Comercial Galé",
  fundacao: "1976",
  endereco: {
    logradouro: "Avenida Prestes Maia, 454",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    regiao: "região da 25 de Março",
  },
  telefoneFixo: "11 3155-5299",
  whatsapp: "11 95042-5307",
  whatsappE164: "5511950425307",
  email: "contato@comercialgale.com.br",
  horario: "Segunda a sexta, das 07h às 17h",
  instagram: "https://www.instagram.com/comercialgale/",
  facebook: "https://www.facebook.com/comercialgale",
} as const;

export function linkWhatsApp(mensagem?: string) {
  const texto = encodeURIComponent(
    mensagem ??
      "Olá! Estou vendo o catálogo online e gostaria de mais informações.",
  );
  return `https://api.whatsapp.com/send?phone=${CONTATO.whatsappE164}&text=${texto}`;
}

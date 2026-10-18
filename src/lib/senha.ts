// Sem l/I/1 e o/O/0: a senha é ditada por telefone ou WhatsApp.
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Senha provisória forte para login criado pelo painel. A pessoa troca no
 * primeiro acesso; quem criou repassa uma vez só.
 *
 * Sorteio por rejeição: 256 não é múltiplo do alfabeto, e um `% length`
 * direto favoreceria os primeiros caracteres.
 */
export function senhaProvisoria(tamanho = 10) {
  const limite = 256 - (256 % ALFABETO.length);
  let senha = "";
  while (senha.length < tamanho) {
    for (const n of crypto.getRandomValues(new Uint8Array(tamanho * 2))) {
      if (n < limite && senha.length < tamanho) senha += ALFABETO[n % ALFABETO.length];
    }
  }
  return senha;
}

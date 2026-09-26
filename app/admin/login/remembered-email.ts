/**
 * O e-mail de quem já entrou neste aparelho, para não precisar digitá-lo
 * de novo no celular. Só o e-mail — senha nunca vai para o navegador; quem
 * guarda senha é o gerenciador do próprio sistema.
 */
const KEY = "vds-admin-email";

export function readRememberedEmail(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberEmail(email: string) {
  try {
    if (email) window.localStorage.setItem(KEY, email.trim());
    else window.localStorage.removeItem(KEY);
  } catch {
    // Navegação privada ou armazenamento bloqueado: só não lembra.
  }
}

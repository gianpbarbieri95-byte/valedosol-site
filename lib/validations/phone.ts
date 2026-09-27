/**
 * Regra de telefone dos formulários do site: DDD + número, com ou sem o 55.
 *
 * Fica num arquivo próprio, sem zod, para o botão de WhatsApp conferir o
 * número no navegador com a mesma regra que o servidor aplica depois.
 */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

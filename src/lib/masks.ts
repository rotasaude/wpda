// Máscaras e validações do canal web do cidadão. A API valida de novo
// (CitizenIdentity); aqui é só para o cidadão ver o erro na hora.
export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function maskPhone(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isMobilePhone(input: string): boolean {
  return /^[1-9][1-9]9\d{8}$/.test(onlyDigits(input));
}

export function maskCpf(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  const head = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(".");
  return d.length > 9 ? `${head}-${d.slice(9)}` : head;
}

export function isValidCpf(input: string): boolean {
  const d = onlyDigits(input);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split("").map(Number);
  const checkDigit = (len: number) => {
    const sum = n.slice(0, len).reduce((acc, x, i) => acc + x * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === n[9] && checkDigit(10) === n[10];
}

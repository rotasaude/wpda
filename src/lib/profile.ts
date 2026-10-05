// Regras de tela do perfil do par (ADR 0027; contrato do módulo 15 §2), sem
// React. O api valida de novo (Citizens::SetProfile → 422); aqui o cidadão vê
// o erro na hora. Nada daqui escreve em console ou URL.
import type { GenderIdentity, ProfileInput, Sex } from "./citizenApi";
import { cityDateFormat, fmtCalendarDate } from "./format";
import { onlyDigits } from "./masks";

export const MAX_AGE = 130;

export const SEX_OPTIONS: readonly { value: Sex; label: string }[] = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" }
];

// Valores do Cadastro Individual do e-SUS APS; null = "Prefiro não informar".
export const GENDER_IDENTITY_OPTIONS: readonly { value: GenderIdentity | null; label: string }[] = [
  { value: null, label: "Prefiro não informar" },
  { value: "cis_woman", label: "Mulher cis" },
  { value: "cis_man", label: "Homem cis" },
  { value: "trans_woman", label: "Mulher trans" },
  { value: "trans_man", label: "Homem trans" },
  { value: "travesti", label: "Travesti" },
  { value: "non_binary", label: "Não binária" },
  { value: "other", label: "Outra" }
];

export function sexLabel(s: Sex): string {
  return SEX_OPTIONS.find(o => o.value === s)?.label ?? "";
}

export function genderIdentityLabel(g: GenderIdentity | null): string {
  if (g === null) return "Não informado";
  return GENDER_IDENTITY_OPTIONS.find(o => o.value === g)?.label ?? "";
}

export const BIRTH_DATE_INVALID = "Digite a data como dia/mês/ano, por exemplo 02/04/1963.";
export const BIRTH_DATE_FUTURE = "A data de nascimento não pode ser depois de hoje.";
export const BIRTH_DATE_TOO_OLD = "Confira o ano de nascimento.";
export const SEX_REQUIRED = "Escolha o sexo.";

export function maskDate(input: string): string {
  const d = onlyDigits(input).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// "02/04/1963" → "1963-04-02"; data que não existe (31/02) → null. Anos de 0001
// a 0099 caem fora sozinhos: Date.UTC os lê como 1900–1999.
export function parseBirthDate(masked: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked.trim());
  if (!m) return null;
  const [ , dd, mm, yyyy ] = m;
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function toMaskedDate(iso: string): string {
  const out = fmtCalendarDate(iso);
  return out === "—" ? "" : out;
}

export function ageOn(birthIso: string, todayIso: string): number {
  const [ by, bm, bd ] = birthIso.split("-").map(Number);
  const [ ty, tm, td ] = todayIso.split("-").map(Number);
  const beforeBirthday = tm < bm || (tm === bm && td < bd);
  return ty - by - (beforeBirthday ? 1 : 0);
}

// Hoje no fuso da cidade (o da sessão do cidadão), em AAAA-MM-DD.
export function todayInCity(now: Date = new Date()): string {
  const parts = cityDateFormat({ year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type ProfileDraft = { birthDate: string; sex: Sex | null; genderIdentity: GenderIdentity | null };
export type ProfileErrors = { birthDate?: string; sex?: string };

export function validateProfile(d: ProfileDraft, today: string):
  { ok: true; value: ProfileInput } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};
  const iso = parseBirthDate(d.birthDate);
  if (!iso) errors.birthDate = BIRTH_DATE_INVALID;
  else if (iso > today) errors.birthDate = BIRTH_DATE_FUTURE;
  else if (ageOn(iso, today) > MAX_AGE) errors.birthDate = BIRTH_DATE_TOO_OLD;
  if (!d.sex) errors.sex = SEX_REQUIRED;
  if (!iso || !d.sex || errors.birthDate) return { ok: false, errors };
  return { ok: true, value: { birth_date: iso, sex: d.sex, gender_identity: d.genderIdentity } };
}

// Regras de tela do acompanhamento do cidadão (módulo 23, F-23.7 e F-23.8;
// spec §6 "Cidadão"; contrato §7). Linguagem simples, sem código nem
// diagnóstico além do nome da linha. Quem decide o que a pessoa vê (só linhas
// inscritas, só par validado, oferta vencida) é o api. Nada daqui escreve em
// console ou URL.
import { ApiError, type CareItem, type DeclaredCondition } from "./citizenApi";
import { fmtCalendarDate } from "./format";
import { messageFor } from "../modules/citizen/ui";

export const CARE_NOT_VERIFIED =
  "Para ver seu acompanhamento por aqui, valide seu cadastro na unidade de saúde com um documento com foto.";
export const CARE_DISABLED = "O acompanhamento ainda não está disponível nesta cidade.";
export const CARE_EMPTY =
  "Nada para acompanhar por aqui ainda. Quando a equipe da sua unidade incluir você num acompanhamento, o que está para fazer aparece aqui.";
export const CONDITIONS_HELP =
  "Opcional. Ajuda a equipe da sua unidade a cuidar de você. Não é diagnóstico, e você pode tirar quando quiser.";
export const CARE_PERSON_GONE = "Não encontramos esta pessoa. Volte e escolha de novo.";
export const CARE_INVALID_CONDITION = "Essa opção não está mais disponível. Atualize a tela.";

// P11: "Estou grávida" fica para todos (homem trans também pode gestar); nada aqui olha `sex`.
export const CONDITION_OPTIONS: readonly { value: Exclude<DeclaredCondition, "none">; label: string }[] = [
  { value: "diabetes", label: "Tenho diabetes" },
  { value: "hypertension", label: "Tenho pressão alta" },
  { value: "pregnancy", label: "Estou grávida" },
  { value: "mental_health", label: "Faço acompanhamento de saúde mental" }
];

export type CareTone = "ok" | "warn" | "neutral";

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Situação em frase; código desconhecido não aparece cru (o item fica, sem a situação).
export function careItemView(item: CareItem): { title: string; status: string | null; tone: CareTone } {
  const title = capitalize(item.label.trim()) || "Cuidado da linha";
  switch (item.status) {
    case "ok": return { title, status: "Em dia", tone: "ok" };
    case "due_soon": {
      const day = fmtCalendarDate(item.due_on);
      return { title, status: day === "—" ? "Está chegando a hora" : `Faça até ${day}`, tone: "warn" };
    }
    case "overdue": return { title, status: "Está na hora — procure a sua unidade de saúde", tone: "warn" };
    // O api nunca manda "untracked" (P5a); fica só como defesa.
    case "untracked": return { title, status: "Confira com a sua equipe de saúde", tone: "neutral" };
    default: return { title, status: null, tone: "neutral" };
  }
}

// Oferta do catálogo ou triagem vencida de "Meu acompanhamento" (L9).
export function lastDoneText(entry: { last_done_at?: string | null }): string | null {
  const day = fmtCalendarDate((entry.last_done_at ?? "").slice(0, 10));
  return day === "—" ? null : `Feita pela última vez em ${day}`;
}

// Códigos do api para o cidadão nas rotas novas; o resto segue o canal (messageFor).
export function careMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "feature_disabled": return CARE_DISABLED;
      case "not_verified": return CARE_NOT_VERIFIED;
      case "invalid_condition": return CARE_INVALID_CONDITION;
      case "not_found": return CARE_PERSON_GONE;
    }
  }
  return messageFor(error);
}

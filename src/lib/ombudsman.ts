// Ouvidoria no canal do cidadão (módulo 33, ADR 0051; contrato §3, §4, §10, §14). Regras de tela puras; nada aqui grava, loga ou monta URL.
import { ApiError } from "./citizenApi";
import type { DeadlineColor, ManifestationState } from "./citizenApi";
import { cityToday, fmtCalendarDate } from "./format";
import { messageFor } from "../modules/citizen/ui";

export const OMBUDSMAN_FEATURE = "ombudsman";
export const ANONYMOUS_WEB_FEATURE = "ombudsman_anonymous_web";

export const ANONYMOUS_WARNING = "Sem identificação, você não recebe protocolo nem acompanha a resposta.";
export const ANONYMOUS_DISABLED = "A denúncia anônima não está disponível agora nesta cidade.";
export const REPORT_HINT = "Conte o que aconteceu, onde e quando. Não escreva seu nome, CPF ou telefone.";
export const PRESERVED_HINT = "Para manter sua identidade preservada, não escreva no texto seu nome, CPF, telefone ou endereço.";
export const OMBUDSMAN_NOTICE_HINT = "Os detalhes estão em \"Minhas manifestações\", na Ouvidoria.";

// Faixas do api (catalog.rb:42-52), em code points depois do strip.
export const BODY_MIN = 20;
export const BODY_MAX = 4000;
export const REASON_MIN = 10;
export const REASON_MAX = 2000;
export const TEXT_MIN = 10; // complemento
export const TEXT_MAX = 4000;
export const NAME_MIN = 2; // full_name
export const NAME_MAX = 120;

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const KIND_LABEL: Record<string, string> = {
  complaint: "Reclamação", report: "Denúncia", praise: "Elogio", suggestion: "Sugestão", request: "Solicitação"
};

const STATE_LABEL: Record<string, string> = {
  received: "Recebida",
  in_analysis: "Em análise",
  forwarded: "Em análise", // W5: o cidadão não sabe do encaminhamento (contrato §3)
  awaiting_complement: "Aguardando seu complemento",
  answered: "Respondida",
  archived: "Arquivada"
};

// W4/F-6: os kinds são os do api (services/ombudsman/catalog.rb:35-38).
const TIMELINE_TITLE: Record<string, string> = {
  received: "Manifestação recebida",
  complement_requested: "A Ouvidoria pediu um complemento",
  complement_received: "Complemento recebido",
  extended: "Prazo prorrogado",
  interim_response: "Resposta parcial da Ouvidoria",
  final_response: "Resposta da Ouvidoria",
  archived: "Manifestação arquivada",
  reopen_requested: "Você pediu a reabertura",
  reopen_rejected: "Pedido de reabertura recusado",
  reopened: "Manifestação reaberta"
};

// Contrato §1 (ombudsman_notices.kind).
const NOTICE_TITLE: Record<string, string> = {
  interim_response: "Novidade na sua manifestação",
  complement_requested: "A Ouvidoria pediu um complemento",
  final_response: "Sua manifestação foi respondida",
  archived: "Sua manifestação foi arquivada",
  reopen_decided: "Pedido de reabertura respondido"
};

export const KIND_OPTIONS = [
  { value: "complaint", label: "Reclamação", hint: "Algo deu errado no atendimento." },
  { value: "report", label: "Denúncia", hint: "Uma irregularidade." },
  { value: "praise", label: "Elogio", hint: "Reconhecer um bom atendimento." },
  { value: "suggestion", label: "Sugestão", hint: "Uma ideia para melhorar o serviço." },
  { value: "request", label: "Solicitação", hint: "Pedir uma providência." }
];

export const MODE_OPTIONS = [
  { value: "identified", label: "Identificada", hint: "A equipe da Ouvidoria vê quem você é." },
  { value: "preserved", label: "Com identidade preservada", hint: "Só o ouvidor pode ver quem você é, e cada vez que ele abre fica registrado." }
];

// Contrato §10: as três perguntas, sem texto livre. Valores em string (o RadioGroup só trabalha com string).
export const SATISFACTION = {
  met: {
    question: "Sua demanda foi atendida?",
    options: [ { value: "yes", label: "Sim" }, { value: "partly", label: "Em parte" }, { value: "no", label: "Não" } ]
  },
  clear: {
    question: "A resposta foi fácil de entender?",
    options: [ { value: "true", label: "Sim" }, { value: "false", label: "Não" } ]
  },
  score: {
    question: "De 1 a 5, qual sua satisfação com a ouvidoria?",
    options: [
      { value: "1", label: "1 (muito insatisfeito)" }, { value: "2", label: "2" }, { value: "3", label: "3" },
      { value: "4", label: "4" }, { value: "5", label: "5 (muito satisfeito)" }
    ]
  }
};

export const kindLabel = (kind: string): string => (has(KIND_LABEL, kind) ? KIND_LABEL[kind] : "Manifestação");
export const stateLabel = (state: string): string => (has(STATE_LABEL, state) ? STATE_LABEL[state] : "Em andamento");
export const timelineTitle = (kind: string): string => (has(TIMELINE_TITLE, kind) ? TIMELINE_TITLE[kind] : "Atualização da Ouvidoria");
export const noticeTitle = (event: string): string => (has(NOTICE_TITLE, event) ? NOTICE_TITLE[event] : "Aviso da Ouvidoria");

// `due_on` é data de calendário (AAAA-MM-DD): comparada e formatada como texto, nunca por new Date.
export function deadlineText(
  m: { state: ManifestationState | string; due_on: string | null; color: DeadlineColor | null },
  today: string = cityToday()
): string | null {
  if (m.state === "answered" || m.state === "archived") return null;
  if (m.state === "awaiting_complement" || m.color === "paused") return "Prazo suspenso até você enviar o complemento";
  if (!m.due_on || !/^\d{4}-\d{2}-\d{2}$/.test(m.due_on)) return null;
  if (m.color === "red" || today > m.due_on) return `O prazo de resposta venceu em ${fmtCalendarDate(m.due_on)}`;
  return `Resposta prevista até ${fmtCalendarDate(m.due_on)}`;
}

// W9: code points depois do trim, como o strip e o length do Ruby. O trim do JS tira mais espaços
// Unicode que o strip do Ruby, mas o wpda manda o texto já aparado, então a conta bate.
export const textLength = (s: string): number => [ ...s.trim() ].length;

const fmtMax = (n: number) => n.toLocaleString("pt-BR");
function rangeError(s: string, min: number, max: number): string | null {
  const n = textLength(s);
  if (n < min) return `Escreva pelo menos ${min} caracteres.`;
  if (n > max) return `Escreva no máximo ${fmtMax(max)} caracteres.`;
  return null;
}

export const bodyError = (s: string) => rangeError(s, BODY_MIN, BODY_MAX);
export const reasonError = (s: string) => rangeError(s, REASON_MIN, REASON_MAX);
export const complementError = (s: string) => rangeError(s, TEXT_MIN, TEXT_MAX);
export function nameError(s: string): string | null {
  const n = textLength(s);
  if (n < NAME_MIN) return "Escreva seu nome.";
  if (n > NAME_MAX) return `Escreva no máximo ${fmtMax(NAME_MAX)} caracteres.`;
  return null;
}

const INVALID_FILE = "Envie um PDF, uma foto JPEG ou PNG, de até 10 MB.";

export function attachmentError(file: File, count: number): string | null {
  if (count >= MAX_ATTACHMENTS) return `No máximo ${MAX_ATTACHMENTS} anexos.`;
  if (!has(ATTACHMENT_TYPES, file.type)) return "Envie um PDF, uma foto JPEG ou PNG.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "O arquivo passa de 10 MB.";
  if (file.size === 0) return INVALID_FILE; // o api recusaria com invalid_file: a mesma frase, sem subir nada
  return null;
}

// W8: nunca o nome do arquivo do aparelho, que pode trazer o nome de quem pediu sigilo.
export const attachmentFilename = (index: number, contentType: string): string =>
  `anexo-${index + 1}.${ATTACHMENT_TYPES[contentType]}`;

export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

const TOO_MANY = "Você já pediu a reabertura desta manifestação.";
const CHANGED = "A manifestação mudou. Veja como ela está agora.";
const ONE_OF_PEOPLE = "Escolha uma das pessoas deste celular.";
export const BAD_CPF = "CPF inválido. Confira os números.";
const TOO_BIG = "O texto ficou grande demais. Encurte e tente de novo.";

// Os 20 códigos reais do api (api-shapes.md §5); o que falta (invalid_cpf, too_many_people, 401...) vem de messageFor.
const CODE_MESSAGE: Record<string, string> = {
  feature_disabled: "A Ouvidoria não está disponível agora nesta cidade.",
  too_many_requests: "Muitos envios em pouco tempo. Tente mais tarde.",
  daily_cap_reached: "O canal de denúncias recebeu muitas mensagens hoje. Tente mais tarde.",
  payload_too_large: TOO_BIG,
  http_413: TOO_BIG,
  not_own_citizen: ONE_OF_PEOPLE,
  invalid_file: INVALID_FILE,
  too_many_attachments: `No máximo ${MAX_ATTACHMENTS} anexos.`,
  manifestation_changed: CHANGED,
  invalid_transition: CHANGED,
  reopen_window_closed: "O prazo de 30 dias para pedir a reabertura terminou.",
  reopen_pending: TOO_MANY,
  reopen_already_requested: TOO_MANY,
  already_answered: "Você já respondeu a pesquisa desta manifestação.",
  satisfaction_window_closed: "O prazo para responder a pesquisa terminou.",
  not_found: "Esta manifestação não está disponível por aqui."
};

// invalid_request: o api diz o campo só em `path` (input.rb:36-38).
const PATH_MESSAGE: Record<string, string> = {
  body: "Confira o tamanho do texto.",
  reason: "Escreva o motivo com 10 a 2.000 caracteres.",
  full_name: "Escreva seu nome, com 2 a 120 caracteres.",
  cpf: BAD_CPF,
  citizen_id: ONE_OF_PEOPLE,
  health_unit_id: "Essa unidade não está mais na lista. Escolha de novo.",
  attachment_ids: "Um dos anexos não vale mais. Remova e anexe de novo."
};

export const GENERIC_MESSAGE = "Algo deu errado. Tente de novo.";

// Leitura que não adianta repetir: a manifestação não está aqui (404) ou a Ouvidoria está desligada. O resto (rede, 5xx) tem "Tentar de novo".
export const isTerminalReadError = (error: unknown): boolean =>
  error instanceof ApiError && (error.code === "not_found" || error.code === "feature_disabled");

// Código desconhecido: frase genérica, nunca o texto que veio do servidor.
export function ombudsmanMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "invalid_request") return error.path && has(PATH_MESSAGE, error.path) ? PATH_MESSAGE[error.path] : GENERIC_MESSAGE;
    if (has(CODE_MESSAGE, error.code)) return CODE_MESSAGE[error.code];
    const common = messageFor(error);
    return typeof common === "string" ? common : GENERIC_MESSAGE;
  }
  return messageFor(error);
}

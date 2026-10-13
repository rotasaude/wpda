// Peças de tela do canal web do cidadão: alvos de toque de 48 px ou mais,
// texto de 18 px, ação principal embaixo (uso com uma mão).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { CityHeader } from "./CityHeader";
import { EmergencyCall } from "./EmergencyCall";
import { ApiError } from "../../lib/citizenApi";

// Cada tela nova (título ou focusKey diferente) rola ao topo e põe o foco no
// h1: o leitor de tela anuncia a tela, sem recomeçar da barra do topo (WP-02).
// O main reserva embaixo o espaço da faixa fixa do 192 (WP-01).
export function Screen({ title, children, footer, focusKey }:
  { title: string; children: ReactNode; footer?: ReactNode; focusKey?: string | number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [ title, focusKey ]);
  return (
    <main id="conteudo" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: 16,
      paddingBottom: "calc(96px + env(safe-area-inset-bottom))", fontSize: 18, maxWidth: 520, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <CityHeader />
        <h1 ref={heading} tabIndex={-1} style={{ fontSize: 24, margin: "4px 0 0" }}>{title}</h1>
      </header>
      <div style={{ flex: 1 }}>{children}</div>
      {footer && <footer style={{ display: "grid", gap: 12, paddingTop: 16 }}>{footer}</footer>}
      <EmergencyCall />
    </main>
  );
}

const variants = {
  primary: { background: "var(--accent)", color: "var(--on-accent)", border: "none" },
  secondary: { background: "transparent", color: "var(--ink)", border: "2px solid var(--rule2)" },
  danger: { background: "var(--down)", color: "var(--on-tone)", border: "none" }
} as const;

// Desabilitado: cor própria em vez de opacidade (contraste legível).
// Borda tracejada: distingue do secundário mesmo no alto contraste (lá --rule = --rule2).
const disabledLook = { background: "var(--sunken)", color: "var(--ink2)", border: "2px dashed var(--rule2)", cursor: "default" } as const;

export const BigButton = forwardRef<HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }>(
  function BigButton({ variant = "primary", style, ...props }, ref) {
    return (
      <button ref={ref} type="button" {...props}
        style={{ minHeight: 56, width: "100%", borderRadius: 12, fontSize: 18, fontWeight: 600,
          cursor: "pointer", ...variants[variant], ...(props.disabled ? disabledLook : {}), ...style }} />
    );
  });

// Confirmação na própria tela, em dois toques (WP-15, WP-16), no lugar da
// caixa nativa do navegador. O foco vai à pergunta; Cancelar o devolve ao botão.
export function ConfirmInline({ label, question, confirmLabel = "Confirmar", busy, onConfirm, variant = "secondary",
  confirmVariant = "primary" }: {
  label: string; question: string; confirmLabel?: string; busy?: boolean; onConfirm: () => void;
  variant?: keyof typeof variants; confirmVariant?: keyof typeof variants;
}) {
  const [ asking, setAsking ] = useState(false);
  const prompt = useRef<HTMLParagraphElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  const promptId = useId();
  useEffect(() => {
    if (asking) prompt.current?.focus();
    else if (wasAsking.current) trigger.current?.focus();
    wasAsking.current = asking;
  }, [ asking ]);
  if (!asking) {
    return <BigButton ref={trigger} variant={variant} disabled={busy} onClick={() => setAsking(true)}>{label}</BigButton>;
  }
  return (
    <div role="group" aria-labelledby={promptId} style={{ display: "grid", gap: 12 }}>
      <p id={promptId} ref={prompt} tabIndex={-1} style={{ margin: 0, fontWeight: 600 }}>{question}</p>
      <BigButton variant={confirmVariant} disabled={busy} onClick={() => { wasAsking.current = false; setAsking(false); onConfirm(); }}>
        {confirmLabel}
      </BigButton>
      <BigButton variant="secondary" onClick={() => setAsking(false)}>Cancelar</BigButton>
    </div>
  );
}

// Aviso de texto livre que fica congelado depois do envio (api#32).
export const FROZEN_TEXT_NOTICE =
  "Depois de enviado, este texto não pode ser alterado. Não escreva nome, telefone, CPF ou outros dados pessoais.";

// `hint` aparece sob o campo antes de qualquer envio e é a descrição dele
// (aria-describedby), lida junto pelo leitor de tela.
// `ref` chega ao input: a tela foca o campo depois de um erro dele (WP-07).
export const Field = forwardRef<HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }>(
  function Field({ label, error, hint, ...props }, ref) {
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    // O erro também descreve o campo: o leitor de tela lê dica e erro juntos.
    const describedBy = [ hint ? hintId : null, error ? errorId : null ].filter(Boolean).join(" ") || undefined;
    return (
      <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        <label htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
        <input id={id} ref={ref} {...props} aria-invalid={Boolean(error)} aria-describedby={describedBy}
          style={{ minHeight: 56, fontSize: 20, padding: "0 12px", borderRadius: 12,
            border: `2px solid ${error ? "var(--down)" : "var(--rule2)"}` }} />
        {hint && <p id={hintId} style={{ margin: 0, fontSize: 15, color: "var(--ink2)" }}>{hint}</p>}
        {error && <ErrorText id={errorId}>{error}</ErrorText>}
      </div>
    );
  });

export function ErrorText({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} role="alert" style={{ color: "var(--down)", margin: 0 }}>{children}</p>;
}

// Interruptor liga/desliga: o rótulo inteiro é o alvo de toque (48 px ou mais).
export function Toggle({ label, description, checked, disabled, onChange }:
  { label: string; description?: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div style={{ display: "grid", gap: 4, marginBottom: 16 }}>
      <label htmlFor={id}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48,
          fontSize: 18, fontWeight: 600, cursor: disabled ? "default" : "pointer", color: disabled ? "var(--ink2)" : undefined }}>
        {label}
        <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled}
          aria-describedby={description ? descriptionId : undefined}
          onChange={e => onChange(e.target.checked)}
          style={{ width: 28, height: 28, flexShrink: 0, margin: 0 }} />
      </label>
      {description && <p id={descriptionId} style={{ margin: 0, fontSize: 18, color: "var(--ink2)" }}>{description}</p>}
    </div>
  );
}

// Escolha única: a opção inteira é o alvo de toque (48 px ou mais). Aceita
// null como valor ("Prefiro não informar").
export function RadioGroup<T extends string | null>({ legend, options, value, onChange, error, disabled }: {
  legend: string; options: readonly { value: T; label: string }[]; value: T | undefined;
  onChange: (value: T) => void; error?: string; disabled?: boolean;
}) {
  const name = useId();
  // O erro descreve o grupo e marca cada opção (A-18).
  const errorId = `${name}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined}
      style={{ border: "none", padding: 0, margin: "0 0 16px", display: "grid", gap: 8 }}>
      <legend style={{ fontWeight: 600, padding: 0, marginBottom: 6 }}>{legend}</legend>
      {options.map(o => (
        <label key={o.value ?? "none"}
          style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, fontSize: 18, padding: "0 12px",
            borderRadius: 12, border: `2px solid ${disabled ? "var(--rule)" : "var(--rule2)"}`,
            cursor: disabled ? "default" : "pointer", color: disabled ? "var(--ink2)" : undefined }}>
          <input type="radio" name={name} checked={value === o.value} disabled={disabled}
            aria-invalid={error ? true : undefined}
            onChange={() => onChange(o.value)} style={{ width: 24, height: 24, margin: 0, flexShrink: 0 }} />
          {o.label}
        </label>
      ))}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </fieldset>
  );
}

export const INVALID_NEIGHBORHOOD_MESSAGE = "Esse bairro não está mais na lista. Escolha de novo.";

const MESSAGES: Record<string, string> = {
  invalid_phone: "Digite um celular com DDD, como (41) 99876-5432.",
  too_soon: "Aguarde um minuto antes de pedir outro código.",
  daily_limit: "Você pediu muitos códigos hoje. Tente amanhã.",
  too_many_requests: "Muitas tentativas. Aguarde um pouco e tente de novo.",
  otp_unavailable: "O envio de SMS está fora do ar. Tente em instantes.",
  invalid_code: "Código errado. Confira o SMS e tente de novo.",
  code_expired: "O código venceu. Peça um novo.",
  code_exhausted: "Muitas tentativas com este código. Peça um novo.",
  invalid_cpf: "CPF inválido. Confira os números.",
  too_many_people: "Este celular já tem 10 pessoas cadastradas.",
  consent_outdated: "O termo foi atualizado. Leia de novo para continuar.",
  no_consent: "É preciso aceitar o termo para continuar.",
  not_in_progress: "Essa triagem não está mais em andamento. Escolha para quem é a nova triagem.",
  no_protocol: "A triagem não está disponível agora nesta cidade.",
  no_consent_term: "A triagem não está disponível agora nesta cidade.",
  invalid_answer: "Não entendemos a resposta. Tente de novo.",
  city_schema_behind: "Serviço em manutenção. Tente em instantes.",
  unauthenticated: "Sua sessão expirou. Entre de novo com seu celular.",
  already_verified: "Seu cadastro já está verificado.",
  triage_too_old: "Esta triagem tem mais de 3 dias. Faça uma triagem nova.",
  triage_not_eligible: "Esta triagem não está disponível para check-in.",
  already_checked_in: "Você já fez o check-in desta triagem.",
  confirmation_closed: "O prazo para confirmar terminou",
  appointment_ended: "Este agendamento já foi encerrado.",
  reason_too_short: "Escreva um motivo com pelo menos 10 caracteres.",
  not_today: "Isso só pode ser feito no dia do horário marcado.",
  appointment_not_eligible: "Este agendamento não está disponível para check-in.",
  invalid_neighborhood: INVALID_NEIGHBORHOOD_MESSAGE,
  // Módulo 15 (contrato §3).
  invalid_birth_date: "Data de nascimento inválida. Confira dia, mês e ano.",
  invalid_sex: "Escolha o sexo.",
  invalid_gender_identity: "Escolha uma opção de identidade de gênero.",
  profile_verified: "Este perfil foi conferido no posto e só pode ser corrigido lá.",
  profile_required: "Antes, informe a data de nascimento e o sexo desta pessoa.",
  not_offered: "Esta triagem não está mais disponível para esta pessoa.",
  triage_in_progress: "Já existe uma triagem em andamento para esta pessoa. Continue a que está aberta.",
  protocol_name_required: "Escolha uma triagem para começar.",
  // Módulo 17 (contrato §5).
  not_reschedulable: "Este horário não pode mais ser trocado por aqui. Fale com a unidade.",
  invalid_reason_code: "Escolha o motivo.",
  invalid_period: "Escolha o melhor período.",
  note_too_long: "Escreva no máximo 200 caracteres.",
  // Módulo 20 (contrato §4).
  feature_disabled: "O histórico ainda não está disponível nesta cidade.",
  not_verified: "Para ver isto, valide seu cadastro na unidade de saúde.",
  not_available: "O resumo de saúde ainda não está disponível.",
  invalid_cursor: "A lista mudou. Volte e abra o histórico de novo."
};

// 429 do PDF (30 downloads a cada 10 min): o código `too_many_requests` é o
// mesmo do SMS, então a frase própria vale só para quem baixa documento.
export const PDF_RATE_LIMITED = "Muitos downloads em pouco tempo. Tente de novo em alguns minutos.";

export function pdfMessageFor(error: unknown): string {
  if (error instanceof ApiError && error.code === "too_many_requests") return PDF_RATE_LIMITED;
  return messageFor(error);
}

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? "Algo deu errado. Tente de novo.";
  return "Sem conexão. Verifique a internet e tente de novo.";
}

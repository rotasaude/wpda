// Peças de tela do canal web do cidadão: alvos de toque de 48 px ou mais,
// texto de 18 px, ação principal embaixo (uso com uma mão).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { ApiError } from "../../lib/citizenApi";

export function Screen({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: 16,
      fontFamily: "system-ui, sans-serif", fontSize: 18, maxWidth: 520, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 14, color: "var(--ink3, #666)" }}>Rota Saúde</strong>
        <h1 style={{ fontSize: 24, margin: "4px 0 0" }}>{title}</h1>
      </header>
      <div style={{ flex: 1 }}>{children}</div>
      {footer && <footer style={{ display: "grid", gap: 12, paddingTop: 16 }}>{footer}</footer>}
      <p style={{ fontSize: 14, color: "var(--ink3, #666)", textAlign: "center" }}>Em emergência, ligue 192.</p>
    </main>
  );
}

const variants = {
  primary: { background: "var(--accent, #2b4bd8)", color: "#fff", border: "none" },
  secondary: { background: "transparent", color: "var(--ink, #222)", border: "1px solid var(--rule2, #ccc)" },
  danger: { background: "var(--down, #c0392b)", color: "#fff", border: "none" }
} as const;

export function BigButton({ variant = "primary", style, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button type="button" {...props}
      style={{ minHeight: 56, width: "100%", borderRadius: 12, fontSize: 18, fontWeight: 600,
        cursor: "pointer", opacity: props.disabled ? 0.6 : 1, ...variants[variant], ...style }} />
  );
}

// Aviso de texto livre que fica congelado depois do envio (api#32).
export const FROZEN_TEXT_NOTICE =
  "Depois de enviado, este texto não pode ser alterado. Não escreva nome, telefone, CPF ou outros dados pessoais.";

// `hint` aparece sob o campo antes de qualquer envio e é a descrição dele
// (aria-describedby), lida junto pelo leitor de tela.
export function Field({ label, error, hint, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
      <label htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
      <input id={id} {...props} aria-invalid={Boolean(error)} aria-describedby={hint ? hintId : undefined}
        style={{ minHeight: 56, fontSize: 20, padding: "0 12px", borderRadius: 12,
          border: `1px solid ${error ? "var(--down, #c0392b)" : "var(--rule2, #ccc)"}` }} />
      {hint && <p id={hintId} style={{ margin: 0, fontSize: 15 }}>{hint}</p>}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p role="alert" style={{ color: "var(--down, #c0392b)", margin: 0 }}>{children}</p>;
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
          fontSize: 18, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1 }}>
        {label}
        <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled}
          aria-describedby={description ? descriptionId : undefined}
          onChange={e => onChange(e.target.checked)}
          style={{ width: 28, height: 28, flexShrink: 0, margin: 0 }} />
      </label>
      {description && <p id={descriptionId} style={{ margin: 0, fontSize: 18, color: "var(--ink2, #555)" }}>{description}</p>}
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
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px", display: "grid", gap: 8 }}>
      <legend style={{ fontWeight: 600, padding: 0, marginBottom: 6 }}>{legend}</legend>
      {options.map(o => (
        <label key={o.value ?? "none"}
          style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, fontSize: 18, padding: "0 12px",
            borderRadius: 12, border: "1px solid var(--rule2, #ccc)", cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.6 : 1 }}>
          <input type="radio" name={name} checked={value === o.value} disabled={disabled}
            onChange={() => onChange(o.value)} style={{ width: 24, height: 24, margin: 0, flexShrink: 0 }} />
          {o.label}
        </label>
      ))}
      {error && <ErrorText>{error}</ErrorText>}
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
  protocol_name_required: "Escolha uma triagem para começar."
};

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? "Algo deu errado. Tente de novo.";
  return "Sem conexão. Verifique a internet e tente de novo.";
}

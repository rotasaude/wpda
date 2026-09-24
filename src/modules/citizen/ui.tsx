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

export function Field({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
      <label htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
      <input id={id} {...props} aria-invalid={Boolean(error)}
        style={{ minHeight: 56, fontSize: 20, padding: "0 12px", borderRadius: 12,
          border: `1px solid ${error ? "var(--down, #c0392b)" : "var(--rule2, #ccc)"}` }} />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p role="alert" style={{ color: "var(--down, #c0392b)", margin: 0 }}>{children}</p>;
}

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
  already_checked_in: "Você já fez o check-in desta triagem."
};

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? "Algo deu errado. Tente de novo.";
  return "Sem conexão. Verifique a internet e tente de novo.";
}

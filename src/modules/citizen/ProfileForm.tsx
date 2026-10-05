// src/modules/citizen/ProfileForm.tsx
// Perfil do par (spec 2026-10-05 §8.2; ADR 0027): data de nascimento, sexo e
// identidade de gênero opcional. Sem <form> nativo: um submit GET poria o
// perfil na URL. A validação local espelha os 422 do api.
import { useState } from "react";
import { citizenApi, type GenderIdentity, type ProfileInput, type Sex } from "../../lib/citizenApi";
import {
  GENDER_IDENTITY_OPTIONS, SEX_OPTIONS, maskDate, toMaskedDate, todayInCity, validateProfile, type ProfileErrors
} from "../../lib/profile";
import { BigButton, ErrorText, Field, RadioGroup, Screen, messageFor } from "./ui";

export const PROFILE_PURPOSE =
  "Usamos a data de nascimento e o sexo só para mostrar as triagens indicadas para esta pessoa. Você pode corrigir depois em \"Meu perfil\".";

const linkStyle = { minHeight: 48, padding: 0, background: "none", border: "none", textDecoration: "underline", fontSize: 18 } as const;

function ConsentTermLink() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && term === null) {
      setError(null);
      citizenApi.consentTerm().then(t => setTerm(t.body)).catch(e => setError(messageFor(e)));
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" aria-expanded={open} onClick={toggle} style={linkStyle}>
        {open ? "Fechar o termo" : "Ler o termo de consentimento"}
      </button>
      {open && (error ? <ErrorText>{error}</ErrorText>
        : term === null ? <p>Carregando…</p>
        : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 18, padding: 12, borderRadius: 12,
            border: "1px solid var(--line, #eee)" }}>{term}</div>)}
    </div>
  );
}

export function ProfileForm({ title, who, initial, busy, error, submitLabel, onSubmit, onBack }: {
  title: string; who?: string; initial?: ProfileInput | null; busy?: boolean; error?: string | null;
  submitLabel: string; onSubmit: (profile: ProfileInput) => void; onBack: () => void;
}) {
  const [birthDate, setBirthDate] = useState(initial ? toMaskedDate(initial.birth_date) : "");
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [genderIdentity, setGenderIdentity] = useState<GenderIdentity | null>(initial?.gender_identity ?? null);
  const [errors, setErrors] = useState<ProfileErrors>({});

  function submit() {
    const result = validateProfile({ birthDate, sex, genderIdentity }, todayInCity());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value);
  }

  return (
    <Screen title={title} footer={<>
      <BigButton disabled={busy} onClick={submit}>{submitLabel}</BigButton>
      <BigButton variant="secondary" disabled={busy} onClick={onBack}>Voltar</BigButton>
    </>}>
      {who && <p>{who}</p>}
      <p>{PROFILE_PURPOSE}</p>
      <ConsentTermLink />
      <Field label="Data de nascimento" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa"
        hint="Dia, mês e ano. Exemplo: 02/04/1963." value={birthDate} error={errors.birthDate} disabled={busy}
        onChange={e => setBirthDate(maskDate(e.target.value))} />
      <RadioGroup legend="Sexo" options={SEX_OPTIONS} value={sex} onChange={setSex} error={errors.sex} disabled={busy} />
      <RadioGroup legend="Identidade de gênero (opcional)" options={GENDER_IDENTITY_OPTIONS} value={genderIdentity}
        onChange={setGenderIdentity} disabled={busy} />
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

// Perfil obrigatório antes do catálogo e "Meu perfil" (spec 2026-10-05 §8.2 e
// §8.6; ADR 0027). declared: o cidadão corrige. verified: conferido no posto,
// só leitura; daí em diante só muda lá (409 profile_verified).
import { useEffect, useRef, useState } from "react";
import { ApiError, citizenApi, type Person, type ProfileInput } from "../../lib/citizenApi";
import { fmtCalendarDate } from "../../lib/format";
import { genderIdentityLabel, sexLabel } from "../../lib/profile";
import { ProfileForm } from "./ProfileForm";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

export const VERIFIED_PROFILE_TEXT =
  "Conferido no posto. Para corrigir, procure uma unidade de saúde com um documento com foto.";

export function ProfileStep({ citizenId, required, onSaved, onBack }:
  { citizenId: string; required: boolean; onSaved: () => void; onBack: () => void }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  function apply(people: Person[]) {
    const p = people.find(x => x.id === citizenId);
    if (p) setPerson(p);
    else setError(messageFor(new ApiError(404, "not_found")));
  }

  useEffect(() => {
    let alive = true;
    citizenApi.people()
      .then(r => { if (alive) apply(r.people); })
      .catch(e => { if (alive) setError(messageFor(e)); });
    return () => { alive = false; };
  }, [citizenId]);

  async function save(input: ProfileInput) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await citizenApi.setProfile(citizenId, input);
      onSaved();
    } catch (e) {
      // Conferido no posto entre a leitura e o envio: relê e mostra só leitura.
      if (e instanceof ApiError && e.code === "profile_verified") {
        await citizenApi.people().then(r => apply(r.people)).catch(() => undefined);
      }
      setError(messageFor(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const title = required ? "Sobre esta pessoa" : "Meu perfil";
  const back = <BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>;

  if (!person) {
    return <Screen title={title} footer={back}>{error ? <ErrorText>{error}</ErrorText> : <p>Carregando…</p>}</Screen>;
  }

  const profile = person.profile ?? null;
  if (profile && profile.profile_source === "verified") {
    return (
      <Screen title="Meu perfil" footer={back}>
        <p>CPF {person.cpf_masked}</p>
        {error && <ErrorText>{error}</ErrorText>}
        <dl style={{ display: "grid", gap: 4, margin: "0 0 16px", fontSize: 18 }}>
          <dt style={{ fontWeight: 600 }}>Data de nascimento</dt>
          <dd style={{ margin: "0 0 8px" }}>{fmtCalendarDate(profile.birth_date)}</dd>
          <dt style={{ fontWeight: 600 }}>Sexo</dt>
          <dd style={{ margin: "0 0 8px" }}>{sexLabel(profile.sex)}</dd>
          <dt style={{ fontWeight: 600 }}>Identidade de gênero</dt>
          <dd style={{ margin: 0 }}>{genderIdentityLabel(profile.gender_identity)}</dd>
        </dl>
        <p style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line, #eee)" }}>{VERIFIED_PROFILE_TEXT}</p>
      </Screen>
    );
  }

  return <ProfileForm key={person.id} title={title} who={`CPF ${person.cpf_masked}`} initial={profile}
    busy={busy} error={error} submitLabel={required ? "Continuar" : "Salvar"}
    onSubmit={input => void save(input)} onBack={onBack} />;
}

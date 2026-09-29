// Preferências de aviso por pessoa do telefone (spec 2026-09-29 §8; ADR 0024):
// opt-in de SMS (só quando a cidade liga o SMS) e silêncio dos avisos (tira o
// selo; os avisos continuam na lista). Um PUT por vez, com o campo mudado.
import { useEffect, useRef, useState } from "react";
import {
  citizenApi, type ContactPreference, type ContactPreferenceChange, type ContactPreferences
} from "../../lib/citizenApi";
import { BigButton, ErrorText, Screen, Toggle, messageFor } from "./ui";

export const SMS_EXPLANATION =
  "A Secretaria de Saúde pode enviar um SMS avisando que há um aviso novo aqui. Você pode desligar quando quiser.";
export const MUTE_EXPLANATION =
  "Os avisos novos deixam de aparecer no número ao lado de Avisos. Eles continuam na lista de avisos.";

export const EMPTY_PREFERENCES =
  "Você ainda não tem cadastro nesta cidade. Depois da sua primeira triagem, suas preferências de aviso aparecem aqui.";

type Feedback = { citizenId: string; ok: boolean; text: string };

export function PreferencesStep({ onBack, onSaved }: { onBack: () => void; onSaved?: () => void }) {
  const [prefs, setPrefs] = useState<ContactPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // Guarda síncrona: setSaving só vale no próximo render, e dois toques cabem antes dele.
  const inFlight = useRef(false);

  function load() {
    setError(null);
    citizenApi.contactPreferences().then(setPrefs).catch(e => setError(messageFor(e)));
  }

  useEffect(() => { load(); }, []);

  async function change(person: ContactPreference, patch: ContactPreferenceChange) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await citizenApi.updateContactPreference(person.citizen_id, patch);
      setPrefs(p => p && {
        ...p,
        people: p.people.map(x => x.citizen_id === person.citizen_id
          ? { ...x, sms_opt_in: saved.sms_opt_in, notices_muted: saved.notices_muted }
          : x)
      });
      setFeedback({ citizenId: person.citizen_id, ok: true, text: "Preferência salva." });
      onSaved?.();
    } catch (e) {
      // O estado não mudou: o interruptor (controlado) volta sozinho.
      setFeedback({ citizenId: person.citizen_id, ok: false, text: messageFor(e) });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen title="Preferências de avisos"
      footer={<BigButton variant="secondary" onClick={onBack}>Voltar aos avisos</BigButton>}>
      {error && <>
        <ErrorText>{error}</ErrorText>
        <BigButton style={{ marginTop: 12 }} onClick={load}>Tentar de novo</BigButton>
      </>}
      {prefs === null && !error && <p>Carregando…</p>}
      {prefs !== null && prefs.people.length === 0 && <p>{EMPTY_PREFERENCES}</p>}
      {prefs?.people.map(p => {
        const title = `CPF ${p.cpf_masked}`;
        const mine = feedback?.citizenId === p.citizen_id ? feedback : null;
        return (
          <section key={p.citizen_id} aria-label={title}
            style={{ marginBottom: 24, padding: 12, borderRadius: 12, border: "1px solid var(--rule2, #ccc)" }}>
            <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>{title}</h2>
            {prefs.sms_available &&
              <Toggle label="Receber avisos por SMS" description={SMS_EXPLANATION}
                checked={p.sms_opt_in} disabled={saving}
                onChange={v => void change(p, { sms_opt_in: v })} />}
            <Toggle label="Silenciar avisos" description={MUTE_EXPLANATION}
              checked={p.notices_muted} disabled={saving}
              onChange={v => void change(p, { notices_muted: v })} />
            {mine && (mine.ok ? <p role="status" style={{ margin: 0 }}>{mine.text}</p> : <ErrorText>{mine.text}</ErrorText>)}
          </section>
        );
      })}
    </Screen>
  );
}

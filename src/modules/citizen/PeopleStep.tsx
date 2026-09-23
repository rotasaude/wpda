import { useEffect, useState } from "react";
import { citizenApi, type Person } from "../../lib/citizenApi";
import { isValidCpf, maskCpf } from "../../lib/masks";
import { BigButton, ErrorText, Field, Screen, messageFor } from "./ui";

export type PersonChoice = { citizenId: string } | { cpf: string };

export function PeopleStep({ onChoose, onHistory }:
  { onChoose: (c: PersonChoice) => void; onHistory: (citizenId: string) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi.people().then(r => setPeople(r.people)).catch(e => setError(messageFor(e)));
  }, []);

  function submitNew() {
    if (!isValidCpf(cpf)) return setError("CPF inválido. Confira os números.");
    onChoose({ cpf });
  }

  return (
    <Screen title="Para quem é esta triagem?">
      {people === null && !error && <p>Carregando…</p>}
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {people?.map(p => (
          <div key={p.id} style={{ display: "grid", gap: 8 }}>
            <BigButton variant="secondary" onClick={() => onChoose({ citizenId: p.id })}>
              CPF {p.cpf_masked}
            </BigButton>
            <button type="button" onClick={() => onHistory(p.id)}
              style={{ minHeight: 48, background: "none", border: "none", textDecoration: "underline", fontSize: 18 }}>
              Ver triagens de {p.cpf_masked}
            </button>
          </div>
        ))}
      </div>
      <Field label="CPF de outra pessoa" inputMode="numeric" value={cpf}
        onChange={e => setCpf(maskCpf(e.target.value))} />
      {error && <ErrorText>{error}</ErrorText>}
      <BigButton onClick={submitNew}>Continuar com este CPF</BigButton>
    </Screen>
  );
}

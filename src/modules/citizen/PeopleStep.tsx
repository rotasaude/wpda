import { useEffect, useRef, useState } from "react";
import { citizenApi, type Neighborhood, type Person } from "../../lib/citizenApi";
import { isValidCpf, maskCpf } from "../../lib/masks";
import { NeighborhoodPicker } from "./NeighborhoodPicker";
import { BigButton, ErrorText, Field, INVALID_NEIGHBORHOOD_MESSAGE, Screen, messageFor } from "./ui";

export type Who = { citizenId: string } | { cpf: string };
export type PersonChoice = Who & { neighborhoodId?: string };
// "invalid_neighborhood": o bairro saiu da lista entre a leitura e o envio (422);
// "done": o Flow cuidou do resto (pergunta, termo ou erro).
export type ChooseOutcome = "done" | "invalid_neighborhood";

type Mode =
  | { at: "list" }
  | { at: "pick-for-start"; who: Who; notice: string | null };

const linkStyle = { minHeight: 48, background: "none", border: "none", textDecoration: "underline", fontSize: 18 } as const;

export function PeopleStep({ onChoose, onHistory }:
  { onChoose: (c: PersonChoice) => Promise<ChooseOutcome>; onHistory: (citizenId: string) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const listRef = useRef<Promise<Neighborhood[]> | null>(null);
  const [mode, setMode] = useState<Mode>({ at: "list" });
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Guarda síncrona: setBusy só vale no próximo render, e dois toques cabem antes dele.
  const inFlight = useRef(false);

  // Lista vazia ou com erro = a cidade não tem bairros (sem semente, spec §9):
  // não pergunta, e a triagem segue sem bairro.
  function reloadNeighborhoods(): Promise<Neighborhood[]> {
    const p = citizenApi.neighborhoods().catch(() => [] as Neighborhood[]);
    listRef.current = p;
    // Resposta velha não sobrescreve a mais nova.
    void p.then(list => { if (listRef.current === p) setNeighborhoods(list); });
    return p;
  }

  function currentNeighborhoods(): Promise<Neighborhood[]> {
    return listRef.current ?? reloadNeighborhoods();
  }

  useEffect(() => {
    citizenApi.people().then(r => setPeople(r.people)).catch(e => setError(messageFor(e)));
    void reloadNeighborhoods();
  }, []);

  async function begin(who: Who, neighborhoodId: string | null) {
    inFlight.current = true;
    setBusy(true);
    try {
      const outcome = await onChoose(neighborhoodId ? { ...who, neighborhoodId } : who);
      if (outcome !== "invalid_neighborhood") return;
      const list = await reloadNeighborhoods();
      if (list.length === 0) {
        setMode({ at: "list" });
        await onChoose(who);
        return;
      }
      setMode({ at: "pick-for-start", who, notice: INVALID_NEIGHBORHOOD_MESSAGE });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  // Pergunta o bairro uma vez, antes de começar, a quem ainda não tem; quem
  // já tem começa direto (a troca é pelo "Trocar bairro").
  async function ask(who: Who, hasNeighborhood: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const list = await currentNeighborhoods();
    if (hasNeighborhood || list.length === 0) return begin(who, null);
    inFlight.current = false;
    setBusy(false);
    setMode({ at: "pick-for-start", who, notice: null });
  }

  function submitNew() {
    if (!isValidCpf(cpf)) return setError("CPF inválido. Confira os números.");
    setError(null);
    void ask({ cpf }, false);
  }

  if (mode.at === "pick-for-start") {
    const who = mode.who;
    return <NeighborhoodPicker title="Em que bairro esta pessoa mora?" neighborhoods={neighborhoods}
      notice={mode.notice} busy={busy}
      onPick={id => { if (!inFlight.current) void begin(who, id); }} onBack={() => setMode({ at: "list" })} />;
  }

  const cityHasNeighborhoods = neighborhoods.length > 0;
  return (
    <Screen title="Para quem é esta triagem?">
      {people === null && !error && <p>Carregando…</p>}
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {people?.map(p => (
          <div key={p.id} style={{ display: "grid", gap: 8 }}>
            <BigButton variant="secondary" disabled={busy} onClick={() => void ask({ citizenId: p.id }, Boolean(p.neighborhood))}>
              CPF {p.cpf_masked}
            </BigButton>
            {(cityHasNeighborhoods || p.neighborhood) &&
              <p style={{ margin: 0 }}>{p.neighborhood ? `Bairro: ${p.neighborhood.name}` : "Bairro não informado"}</p>}
            <button type="button" onClick={() => onHistory(p.id)} style={linkStyle}>
              Ver triagens de {p.cpf_masked}
            </button>
          </div>
        ))}
      </div>
      <Field label="CPF de outra pessoa" inputMode="numeric" value={cpf}
        onChange={e => setCpf(maskCpf(e.target.value))} />
      {error && <ErrorText>{error}</ErrorText>}
      <BigButton disabled={busy} onClick={submitNew}>Continuar com este CPF</BigButton>
    </Screen>
  );
}

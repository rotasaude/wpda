import { useEffect, useRef, useState } from "react";
import { ApiError, citizenApi, type Neighborhood, type Person, type ProfileInput } from "../../lib/citizenApi";
import { isValidCpf, maskCpf } from "../../lib/masks";
import { NeighborhoodPicker } from "./NeighborhoodPicker";
import { ProfileForm } from "./ProfileForm";
import { BigButton, ErrorText, Field, INVALID_NEIGHBORHOOD_MESSAGE, Screen, messageFor } from "./ui";
import { PendingConfirmations } from "./PendingConfirmations";

// CPF novo leva o perfil junto: o par nasce com ele (contrato §3.2).
export type Who = { citizenId: string } | { cpf: string; profile: ProfileInput };
export type PersonChoice = Who & { neighborhoodId?: string };
// "invalid_neighborhood": o bairro saiu da lista entre a leitura e o envio (422);
// "done": o Flow cuidou do resto (pergunta, termo ou erro).
export type ChooseOutcome = "done" | "invalid_neighborhood";

type Mode =
  | { at: "list" }
  | { at: "profile-for-new"; cpf: string }
  | { at: "pick-for-start"; who: Who; notice: string | null }
  | { at: "pick-for-change"; person: Person; notice: string | null };

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
  const [saved, setSaved] = useState<string | null>(null);
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

  function loadPeople() {
    citizenApi.people().then(r => setPeople(r.people)).catch(e => setError(messageFor(e)));
  }

  useEffect(() => {
    loadPeople();
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
    setSaved(null);
    inFlight.current = true;
    setBusy(true);
    const list = await currentNeighborhoods();
    if (hasNeighborhood || list.length === 0) return begin(who, null);
    inFlight.current = false;
    setBusy(false);
    setMode({ at: "pick-for-start", who, notice: null });
  }

  // CPF novo: perfil primeiro, depois o bairro (o 422 de bairro continua
  // tratado em begin(), sem perder o perfil digitado).
  function submitNew() {
    if (!isValidCpf(cpf)) return setError("CPF inválido. Confira os números.");
    setError(null);
    setMode({ at: "profile-for-new", cpf });
  }

  // "Trocar bairro" (spec §4.1): null tira o bairro. Não muda triagens antigas.
  async function change(person: Person, neighborhoodId: string | null) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await citizenApi.setNeighborhood(person.id, neighborhoodId);
      setMode({ at: "list" });
      setSaved("Bairro atualizado.");
      loadPeople();
    } catch (e) {
      if (e instanceof ApiError && e.code === "invalid_neighborhood") {
        const list = await reloadNeighborhoods();
        if (list.length === 0) {
          setMode({ at: "list" });
          setSaved(INVALID_NEIGHBORHOOD_MESSAGE);
        } else {
          setMode({ at: "pick-for-change", person, notice: INVALID_NEIGHBORHOOD_MESSAGE });
        }
      } else {
        setMode({ at: "pick-for-change", person, notice: messageFor(e) });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (mode.at === "profile-for-new") {
    const newCpf = mode.cpf;
    return <ProfileForm title="Sobre esta pessoa" who={`CPF ${newCpf}`} busy={busy} submitLabel="Continuar"
      onSubmit={profile => void ask({ cpf: newCpf, profile }, false)}
      onBack={() => setMode({ at: "list" })} />;
  }

  if (mode.at === "pick-for-change") {
    const person = mode.person;
    return <NeighborhoodPicker title={`Bairro de ${person.cpf_masked}`} neighborhoods={neighborhoods}
      notice={mode.notice} busy={busy}
      onPick={id => void change(person, id)} onBack={() => setMode({ at: "list" })} />;
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
      {people && people.length > 0 && <PendingConfirmations people={people} onOpen={onHistory} />}
      {saved && <p role="status">{saved}</p>}
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {people?.map(p => (
          <div key={p.id} style={{ display: "grid", gap: 8 }}>
            <BigButton variant="secondary" disabled={busy} onClick={() => void ask({ citizenId: p.id }, Boolean(p.neighborhood))}>
              CPF {p.cpf_masked}
            </BigButton>
            {(cityHasNeighborhoods || p.neighborhood) &&
              <p style={{ margin: 0 }}>{p.neighborhood ? `Bairro: ${p.neighborhood.name}` : "Bairro não informado"}</p>}
            {cityHasNeighborhoods &&
              <button type="button" disabled={busy} style={linkStyle}
                onClick={() => { setSaved(null); setMode({ at: "pick-for-change", person: p, notice: null }); }}>
                Trocar bairro de {p.cpf_masked}
              </button>}
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

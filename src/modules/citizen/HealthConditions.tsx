// Condições de saúde declaradas (módulo 23, F-23.7; spec, decisões do
// coordenador; contrato §7): o próprio cidadão diz, opcional e retirável;
// NUNCA é diagnóstico. Só par validado (403 not_verified some com a seção) e
// só com care_lines (quem decide mostrar é o ProfileStep). Cada interruptor
// grava na hora; a lista que vale é a que o api devolve. A condição vai só no
// corpo — nunca na URL.
import { useEffect, useRef, useState } from "react";
import { ApiError, citizenApi, type DeclaredCondition, type DeclaredConditionEntry } from "../../lib/citizenApi";
import { CONDITIONS_HELP, CONDITION_OPTIONS, careMessage } from "../../lib/care";
import { ErrorText, Toggle } from "./ui";

const HIDDEN = new Set([ "not_verified", "feature_disabled" ]);
const activeOf = (list: DeclaredConditionEntry[]) => new Set(list.map((c) => c.condition));
const hides = (e: unknown) => e instanceof ApiError && HIDDEN.has(e.code);

export function HealthConditions({ citizenId }: { citizenId: string }) {
  const [ active, setActive ] = useState<Set<string> | null>(null);
  const [ hidden, setHidden ] = useState(false);
  // Só o interruptor em curso fica desabilitado (C04); o aviso de status fica sempre montado.
  const [ pending, setPending ] = useState<Set<string>>(new Set());
  const [ notice, setNotice ] = useState("");
  const [ error, setError ] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const dirty = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    citizenApi.declaredConditions(citizenId)
      .then((list) => { if (alive.current) setActive(activeOf(list)); })
      .catch((e) => {
        if (!alive.current) return;
        if (hides(e)) setHidden(true);
        else setError(careMessage(e));
      });
    return () => { alive.current = false; };
  }, [ citizenId ]);

  // Lê a lista do api e aplica; falha segue o mesmo tratamento de sempre (some ou mostra a frase).
  async function reread() {
    try {
      const list = await citizenApi.declaredConditions(citizenId);
      if (alive.current) setActive(activeOf(list));
    } catch (e) {
      if (!alive.current) return;
      if (hides(e)) setHidden(true);
      else setError(careMessage(e));
    }
  }

  async function toggle(condition: Exclude<DeclaredCondition, "none">, on: boolean) {
    if (inFlight.current.has(condition)) return;
    // Gravações sobrepostas: a resposta de uma pode chegar depois da outra e
    // trazer uma lista velha. Com outra em voo, ninguém aplica a sua lista;
    // quando a última termina, relê o api.
    if (inFlight.current.size > 0) dirty.current = true;
    inFlight.current.add(condition);
    setPending(new Set(inFlight.current));
    setNotice(""); setError(null);
    const alone = () => inFlight.current.size === 1 && !dirty.current;
    try {
      const list = on ? await citizenApi.declareCondition(citizenId, condition) : await citizenApi.withdrawCondition(citizenId, condition);
      if (!alive.current) return;
      if (alone()) setActive(activeOf(list)); else dirty.current = true;
      setNotice(on ? "Informação salva." : "Informação retirada.");
    } catch (e) {
      if (!alive.current) return;
      if (hides(e)) setHidden(true);
      else if (!on && e instanceof ApiError && e.code === "not_found") {
        // C03: a condição já não valia. Relê a lista e reaplica, sem mensagem, para o interruptor não ficar preso.
        if (alone()) await reread(); else dirty.current = true;
      } else setError(careMessage(e));
    } finally {
      inFlight.current.delete(condition);
      if (alive.current) {
        setPending(new Set(inFlight.current));
        if (inFlight.current.size === 0 && dirty.current) { dirty.current = false; await reread(); }
      }
    }
  }

  if (hidden) return null;
  return (
    <section aria-labelledby="health-conditions" style={{ marginTop: 24 }}>
      <h2 id="health-conditions" style={{ fontSize: 20, margin: "0 0 8px" }}>Condições de saúde</h2>
      <p style={{ margin: "0 0 12px", color: "var(--ink2)" }}>{CONDITIONS_HELP}</p>
      {active === null && !error && <p>Carregando…</p>}
      {active && CONDITION_OPTIONS.map((o) => (
        <Toggle key={o.value} label={o.label} checked={active.has(o.value)} disabled={pending.has(o.value)}
          onChange={(on) => void toggle(o.value, on)} />
      ))}
      <p role="status" style={{ margin: 0 }}>{notice}</p>
      {error && <ErrorText>{error}</ErrorText>}
    </section>
  );
}

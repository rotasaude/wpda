// Faixa no topo da escolha de pessoa (api#39): horários que ainda pedem
// confirmação, para quem entra pelo SMS de lembrete ou por conta própria.
// Some quando não há nada a confirmar; erro de rede também não mostra nada
// (a lista completa continua em "Ver triagens").
import { useEffect, useState } from "react";
import { citizenApi, type Person } from "../../lib/citizenApi";
import { cityDateFormat } from "../../lib/format";

type Pending = { citizenId: string; cpfMasked: string; deadline: string };

function fmt(iso: string): string {
  return cityDateFormat({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function PendingConfirmations({ people, onOpen }:
  { people: Person[]; onOpen: (citizenId: string) => void }) {
  const [pending, setPending] = useState<Pending[]>([]);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    Promise.all(people.map(p => citizenApi.appointments(p.id)
      .then(d => d.appointments.flatMap(item => {
        const a = item.appointment;
        if (!a || a.status !== "scheduled" || !a.confirmation_deadline_at) return [];
        if (new Date(a.confirmation_deadline_at).getTime() <= now) return [];
        return [{ citizenId: p.id, cpfMasked: p.cpf_masked, deadline: a.confirmation_deadline_at }];
      }))
      .catch(() => [] as Pending[])))
      .then(lists => { if (alive) setPending(lists.flat().sort((x, y) => x.deadline.localeCompare(y.deadline))); });
    return () => { alive = false; };
  }, [people]);

  if (pending.length === 0) return null;

  return (
    <section role="region" aria-label="Horários para confirmar"
      style={{ background: "var(--warnBg, #fff4e0)", padding: 12, borderRadius: 12, marginBottom: 16 }}>
      <p style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>
        {pending.length === 1 ? "Você tem 1 horário para confirmar" : `Você tem ${pending.length} horários para confirmar`}
      </p>
      {pending.map(p => (
        <button key={`${p.citizenId}-${p.deadline}`} type="button" onClick={() => onOpen(p.citizenId)}
          style={{ display: "block", background: "none", border: 0, padding: "4px 0", textDecoration: "underline",
            color: "inherit", fontSize: 16, cursor: "pointer", textAlign: "left" }}>
          CPF {p.cpfMasked}: confirme até {fmt(p.deadline)}
        </button>
      ))}
    </section>
  );
}

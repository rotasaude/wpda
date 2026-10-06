// src/modules/citizen/NoticesStep.tsx
// Caixa de avisos da Secretaria (spec 2026-09-29 §8; ADR 0024; módulo 17
// F-17.8). Avisos de todas as pessoas do telefone da sessão: campanhas e o
// lembrete da véspera de um horário confirmado. Com mais de uma pessoa, o CPF
// mascarado diz de quem é (cidadão não tem nome). Tocar abre o texto e marca
// lido. O texto é simples: o React escapa tudo e o pre-wrap preserva as
// quebras de linha.
import { useEffect, useRef, useState } from "react";
import { citizenApi, type Notice, type ReminderNotice } from "../../lib/citizenApi";
import { fmtDate, fmtWeekdayDateTime } from "../../lib/format";
import { formatAddress } from "../../lib/territory";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

export const EMPTY_NOTICES = "Nenhum aviso da Secretaria por enquanto.";
export const REMINDER_TITLE = "Lembrete de horário";
export const REMINDER_HINT =
  "Se não puder ir, abra \"Seus agendamentos\", em Minhas triagens, e toque em \"Não posso nesse horário\".";

const itemStyle = {
  display: "grid", gap: 4, width: "100%", minHeight: 56, padding: 12, textAlign: "left",
  borderRadius: 12, border: "1px solid var(--rule2, #ccc)", fontSize: 18, cursor: "pointer",
  color: "var(--ink, #222)"
} as const;

const newStyle = {
  alignSelf: "start", padding: "0 8px", borderRadius: 999, fontSize: 18, fontWeight: 600,
  background: "var(--accent, #2b4bd8)", color: "#fff"
} as const;

function ReminderDetail({ notice, onBack }: { notice: ReminderNotice; onBack: () => void }) {
  const address = formatAddress(notice.unit_address);
  return (
    <Screen title={REMINDER_TITLE}
      footer={<BigButton variant="secondary" onClick={onBack}>Voltar aos avisos</BigButton>}>
      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>{fmtWeekdayDateTime(notice.scheduled_at)}</p>
      {notice.cpf_masked && <p style={{ margin: "0 0 4px" }}>Para o CPF {notice.cpf_masked}</p>}
      {notice.appointment_type_name && <p style={{ margin: "0 0 4px" }}>{notice.appointment_type_name}</p>}
      {notice.professional_name && <p style={{ margin: "0 0 4px" }}>Com {notice.professional_name}</p>}
      {notice.unit_name && <p style={{ margin: "0 0 4px" }}>{notice.unit_name}</p>}
      {address && <p style={{ margin: "0 0 4px", color: "var(--ink2, #555)" }}>{address}</p>}
      <p style={{ marginTop: 16 }}>{REMINDER_HINT}</p>
    </Screen>
  );
}

function ItemContent({ notice }: { notice: Notice }) {
  const badge = !notice.read && <span style={newStyle}>novo</span>;
  const cpf = notice.cpf_masked && <span>Para o CPF {notice.cpf_masked}</span>;
  if (notice.kind === "appointment_reminder") {
    return (
      <>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong>{REMINDER_TITLE}</strong>{badge}
        </span>
        <span style={{ color: "var(--ink2, #555)" }}>{fmtWeekdayDateTime(notice.scheduled_at)}</span>
        {notice.appointment_type_name && <span>{notice.appointment_type_name}</span>}
        {cpf}
      </>
    );
  }
  return (
    <>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>{notice.title}</strong>{badge}
      </span>
      <span style={{ color: "var(--ink2, #555)" }}>{fmtDate(notice.dispatched_at)}</span>
      {cpf}
    </>
  );
}

export function NoticesStep({ onBack, onPreferences, onRead }:
  { onBack: () => void; onPreferences?: () => void; onRead?: () => void }) {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Um POST por aviso: a abertura repetida antes da resposta não manda outro.
  const asked = useRef(new Set<string>());

  function load() {
    setError(null);
    citizenApi.notices().then(r => setNotices(r.notices)).catch(e => setError(messageFor(e)));
  }

  useEffect(() => { load(); }, []);

  function open(n: Notice) {
    setOpenId(n.id);
    if (n.read || asked.current.has(n.id)) return;
    asked.current.add(n.id);
    citizenApi.readNotice(n.id)
      .then(() => {
        setNotices(list => list && list.map(x => (x.id === n.id ? { ...x, read: true } : x)));
        onRead?.();
      })
      // Falhou (rede, ou 404 porque a linha foi apagada): o texto já está na
      // tela; o aviso segue "novo" e a próxima abertura tenta de novo.
      .catch(() => { asked.current.delete(n.id); });
  }

  const current = notices?.find(n => n.id === openId) ?? null;
  if (current && current.kind === "appointment_reminder") {
    return <ReminderDetail notice={current} onBack={() => setOpenId(null)} />;
  }
  if (current) {
    return (
      <Screen title={current.title}
        footer={<BigButton variant="secondary" onClick={() => setOpenId(null)}>Voltar aos avisos</BigButton>}>
        <p style={{ margin: "0 0 4px", color: "var(--ink2, #555)" }}>{fmtDate(current.dispatched_at)}</p>
        {current.cpf_masked && <p style={{ margin: "0 0 4px" }}>Para o CPF {current.cpf_masked}</p>}
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, overflowWrap: "anywhere", marginTop: 16 }}>
          {current.body}
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Avisos" footer={<>
      {onPreferences && <BigButton variant="secondary" onClick={onPreferences}>Preferências de avisos</BigButton>}
      <BigButton variant="secondary" onClick={onBack}>Voltar ao início</BigButton>
    </>}>
      {error && <>
        <ErrorText>{error}</ErrorText>
        <BigButton style={{ marginTop: 12 }} onClick={load}>Tentar de novo</BigButton>
      </>}
      {notices === null && !error && <p>Carregando…</p>}
      {notices !== null && notices.length === 0 && <p>{EMPTY_NOTICES}</p>}
      {notices !== null && notices.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {notices.map(n => (
            <li key={`${n.kind ?? "campaign"}:${n.id}`}>
              <button type="button" onClick={() => open(n)}
                style={{ ...itemStyle, background: n.read ? "transparent" : "var(--accent-bg, #eef1ff)" }}>
                <ItemContent notice={n} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

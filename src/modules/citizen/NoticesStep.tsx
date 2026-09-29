// src/modules/citizen/NoticesStep.tsx
// Caixa de avisos da Secretaria (spec 2026-09-29 §8; ADR 0024). Avisos de todas
// as pessoas do telefone da sessão; com mais de uma, o CPF mascarado diz de quem
// é (cidadão não tem nome). Tocar abre o texto e marca lido. O texto é simples:
// o React escapa tudo e o pre-wrap preserva as quebras de linha.
import { useEffect, useRef, useState } from "react";
import { citizenApi, type Notice } from "../../lib/citizenApi";
import { fmtDate } from "../../lib/format";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

export const EMPTY_NOTICES = "Nenhum aviso da Secretaria por enquanto.";

const itemStyle = {
  display: "grid", gap: 4, width: "100%", minHeight: 56, padding: 12, textAlign: "left",
  borderRadius: 12, border: "1px solid var(--rule2, #ccc)", fontSize: 18, cursor: "pointer",
  color: "var(--ink, #222)"
} as const;

const newStyle = {
  alignSelf: "start", padding: "0 8px", borderRadius: 999, fontSize: 18, fontWeight: 600,
  background: "var(--accent, #2b4bd8)", color: "#fff"
} as const;

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
            <li key={n.id}>
              <button type="button" onClick={() => open(n)}
                style={{ ...itemStyle, background: n.read ? "transparent" : "var(--accent-bg, #eef1ff)" }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{n.title}</strong>
                  {!n.read && <span style={newStyle}>novo</span>}
                </span>
                <span style={{ color: "var(--ink2, #555)" }}>{fmtDate(n.dispatched_at)}</span>
                {n.cpf_masked && <span>Para o CPF {n.cpf_masked}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

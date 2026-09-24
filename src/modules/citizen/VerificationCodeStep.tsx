// "Validar no posto" (spec 2026-09-24-citizen-presencial-verification §5): o
// código que o cidadão mostra ao atendente, com a contagem até vencer.
import { useEffect, useRef, useState } from "react";
import { citizenApi } from "../../lib/citizenApi";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function VerificationCodeStep({ citizenId, onBack }: { citizenId: string; onBack: () => void }) {
  const [data, setData] = useState<{ code: string; expires_at: string } | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Conta cada emissão: uma resposta só é aplicada se ainda for a mais
  // recente pedida, senão um código já invalidado por um pedido mais novo
  // pode "vencer" na tela por chegar depois (rede lenta / gerar de novo
  // rápido demais).
  const requestId = useRef(0);

  async function issue() {
    const id = ++requestId.current;
    setError(null);
    setBusy(true);
    try {
      const d = await citizenApi.issueVerificationCode(citizenId);
      if (requestId.current !== id) return;
      setData(d);
      setLeft(remaining(d.expires_at));
    } catch (e) {
      if (requestId.current !== id) return;
      setError(messageFor(e));
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  }

  useEffect(() => { void issue(); }, [citizenId]);

  useEffect(() => {
    if (!data || left <= 0) return;
    const t = setTimeout(() => setLeft(remaining(data.expires_at)), 1000);
    return () => clearTimeout(t);
  }, [data, left]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Screen title="Validar no posto"
      footer={<>
        <BigButton onClick={issue} disabled={busy}>Gerar outro código</BigButton>
        <BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>
      </>}>
      {error && <ErrorText>{error}</ErrorText>}
      {data && (
        <>
          <p>Mostre este código e um documento com foto ao atendente.</p>
          <p aria-live="polite" style={{ fontSize: 48, fontWeight: 700, letterSpacing: 8, textAlign: "center", margin: "24px 0" }}>
            {data.code}
          </p>
          {left > 0
            ? <p style={{ textAlign: "center" }}>Vale por mais {mm}:{ss}</p>
            : <p role="alert" style={{ textAlign: "center" }}>Este código venceu.</p>}
        </>
      )}
    </Screen>
  );
}

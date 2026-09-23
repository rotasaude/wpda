import { useEffect, useState } from "react";
import { citizenApi } from "../../lib/citizenApi";
import { onlyDigits } from "../../lib/masks";
import { BigButton, ErrorText, Field, Screen, messageFor } from "./ui";

export function CodeStep({ phone, onVerified, onChangePhone }:
  { phone: string; onVerified: () => void; onChangePhone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(60);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await citizenApi.verifyCode(phone, code);
      onVerified();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await citizenApi.requestCode(phone);
      setWait(60);
    } catch (e) {
      setError(messageFor(e));
    }
  }

  return (
    <Screen title="Digite o código"
      footer={<>
        <BigButton onClick={submit} disabled={busy || code.length !== 6}>Confirmar</BigButton>
        <BigButton variant="secondary" onClick={resend} disabled={wait > 0}>
          {wait > 0 ? `Reenviar código em 0:${String(wait).padStart(2, "0")}` : "Reenviar código"}
        </BigButton>
        <BigButton variant="secondary" onClick={onChangePhone}>Trocar número</BigButton>
      </>}>
      <p>Enviamos um código de 6 números para {phone}.</p>
      <Field label="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
        onChange={e => setCode(onlyDigits(e.target.value).slice(0, 6))} />
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

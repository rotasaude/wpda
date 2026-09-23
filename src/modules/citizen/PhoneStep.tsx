import { useState } from "react";
import { citizenApi } from "../../lib/citizenApi";
import { isMobilePhone, maskPhone } from "../../lib/masks";
import { BigButton, ErrorText, Field, Screen, messageFor } from "./ui";

export function PhoneStep({ onSent }: { onSent: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isMobilePhone(phone)) return setError("Digite um celular com DDD, como (41) 99876-5432.");
    setBusy(true);
    setError(null);
    try {
      await citizenApi.requestCode(phone);
      onSent(phone);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Triagem de saúde"
      footer={<BigButton onClick={submit} disabled={busy}>Receber código</BigButton>}>
      <p>Vamos mandar um código por SMS para confirmar seu celular.</p>
      <Field label="Seu celular" inputMode="numeric" autoComplete="tel-national" value={phone}
        onChange={e => setPhone(maskPhone(e.target.value))} />
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

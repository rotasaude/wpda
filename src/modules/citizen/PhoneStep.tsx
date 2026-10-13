import { useRef, useState } from "react";
import { ApiError, citizenApi } from "../../lib/citizenApi";
import { isMobilePhone, maskPhone } from "../../lib/masks";
import { BigButton, ErrorText, Field, Screen, messageFor } from "./ui";

export function PhoneStep({ onSent }: { onSent: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Erro do próprio campo: fica preso a ele, com o foco (WP-07).
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function failField(message: string) {
    setFieldError(message);
    input.current?.focus();
  }

  async function submit() {
    setError(null);
    if (!isMobilePhone(phone)) return failField(messageFor(new ApiError(422, "invalid_phone")));
    setBusy(true);
    setFieldError(null);
    try {
      await citizenApi.requestCode(phone);
      onSent(phone);
    } catch (e) {
      if (e instanceof ApiError && e.code === "invalid_phone") failField(messageFor(e));
      else setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Triagem de saúde"
      footer={<BigButton onClick={submit} disabled={busy}>Receber código</BigButton>}>
      <p>Vamos mandar um código por SMS para confirmar seu celular.</p>
      <Field ref={input} label="Seu celular" inputMode="numeric" autoComplete="tel-national" value={phone}
        error={fieldError ?? undefined}
        onChange={e => setPhone(maskPhone(e.target.value))} />
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

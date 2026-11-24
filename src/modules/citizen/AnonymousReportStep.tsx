// Denúncia anônima sem login (módulo 33, contrato §4, §14; ADR 0051). Rota pública, sem cookie (Q41):
// o corpo é { body }, com health_unit_id opcional e, com subtipo, zoonoses_subtype e place_address juntos (35b, contrato §4, Q15); a resposta nunca é lida (não há protocolo).
// Sem anexo e sem contato. O texto vive só no estado do React.
import { useEffect, useRef, useState } from "react";
import { ApiError, citizenApi, type ZoonosesSubtype } from "../../lib/citizenApi";
import {
  ANONYMOUS_DISABLED, ANONYMOUS_WARNING, ANONYMOUS_WEB_FEATURE, BODY_MAX, REPORT_HINT, YES_NO_OPTIONS, ZOONOSES_ADDRESS_LABEL,
  ZOONOSES_NOTICE, ZOONOSES_QUESTION, ZOONOSES_SUBTYPES, bodyError, ombudsmanMessage, placeAddressError
} from "../../lib/ombudsman";
import { BigButton, ErrorText, Field, RadioGroup, Screen } from "./ui";
import { TextArea, UnitSelect } from "./OmbudsmanFields";

type Unit = { id: string; name: string };
type Mode = "loading" | "disabled" | "form" | "sent";

const warnNote = { background: "var(--warn-bg)", padding: 12, borderRadius: 12, margin: 0 } as const;

const invalidPath = (e: unknown, path: string) => e instanceof ApiError && e.code === "invalid_request" && e.path === path;
// Só a denúncia anônima foi desligada (a Ouvidoria segue): o 403 diz qual interruptor recusou.
const anonymousOff = (e: unknown) => e instanceof ApiError && e.code === "feature_disabled" && e.feature === ANONYMOUS_WEB_FEATURE;

// `offPhone`: aberta fora do celular (desktop de produção, U2), onde não há manifestação.
export function AnonymousReportStep({ onBack, offPhone = false }: { onBack: () => void; offPhone?: boolean }) {
  const [ mode, setMode ] = useState<Mode>("loading");
  const [ units, setUnits ] = useState<Unit[]>([]);
  const [ unitId, setUnitId ] = useState<string | null>(null);
  const [ text, setText ] = useState("");
  const [ fieldError, setFieldError ] = useState<string | null>(null);
  const [ unitError, setUnitError ] = useState<string | null>(null);
  const [ error, setError ] = useState<string | null>(null);
  const [ busy, setBusy ] = useState(false);
  const [ zoonosesOn, setZoonosesOn ] = useState(false);
  const [ aboutAnimals, setAboutAnimals ] = useState<string | undefined>(undefined);
  const [ subtype, setSubtype ] = useState<ZoonosesSubtype | undefined>(undefined);
  const [ placeAddress, setPlaceAddress ] = useState("");
  const [ addressError, setAddressError ] = useState<string | null>(null);
  const [ subtypeError, setSubtypeError ] = useState<string | null>(null);
  const addressInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false); // o estado só vale no próximo render; o ref fecha a porta no mesmo tick
  const alive = useRef(true);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    alive.current = true;
    citizenApi.ombudsmanPublicConfig().then(
      c => {
        if (!alive.current) return;
        setUnits(c.units);
        setZoonosesOn(c.zoonoses === true);
        setMode(c.anonymous_web ? "form" : "disabled");
      },
      () => { if (alive.current) setMode("disabled"); }
    );
    return () => { alive.current = false; };
  }, []);

  function failField(message: string) {
    setFieldError(message);
    field.current?.focus();
  }

  // A unidade escolhida saiu da lista: volta a "Nenhuma unidade específica" e relê as unidades.
  function refreshUnits() {
    setUnitId(null);
    citizenApi.ombudsmanPublicConfig().then(c => { if (alive.current) setUnits(c.units); }, () => { /* fica a lista que havia */ });
  }

  function clearZoonoses() {
    setAboutAnimals(undefined);
    setSubtype(undefined);
    setPlaceAddress("");
    setAddressError(null);
    setSubtypeError(null);
  }

  // O interruptor mudou entre a leitura e o envio: relê, tira a pergunta e mantém o texto.
  function refreshZoonoses() {
    citizenApi.ombudsmanPublicConfig().then(
      c => { if (alive.current) { setUnits(c.units); setZoonosesOn(c.zoonoses === true); } },
      () => { if (alive.current) setZoonosesOn(false); }
    );
  }

  async function submit() {
    if (inFlight.current) return;
    setError(null); setFieldError(null); setUnitError(null); setAddressError(null); setSubtypeError(null);
    const asking = zoonosesOn && aboutAnimals === "yes";
    // O endereço nunca vai sozinho; com o assunto, ele é obrigatório (Q15). Sem os dois, a pergunta fica sem resposta.
    if (asking && !subtype && placeAddress.trim() !== "") return setSubtypeError("Escolha o assunto.");
    const withZoonoses = asking && subtype !== undefined;
    const addressBad = withZoonoses ? placeAddressError(placeAddress) : null;
    if (addressBad) { setAddressError(addressBad); return addressInput.current?.focus(); }
    const local = bodyError(text);
    if (local) return failField(local);
    inFlight.current = true;
    setBusy(true);
    try {
      await citizenApi.sendAnonymousReport({ body: text.trim(), healthUnitId: unitId,
        ...(withZoonoses && subtype ? { zoonoses: { subtype, placeAddress: placeAddress.trim() } } : {})
      });
      if (alive.current) setMode("sent");
    } catch (e) {
      if (!alive.current) return;
      if (invalidPath(e, "body")) failField(bodyError(text) ?? ombudsmanMessage(e));
      else if (invalidPath(e, "place_address")) { setAddressError(ombudsmanMessage(e)); addressInput.current?.focus(); }
      else if (invalidPath(e, "zoonoses_subtype")) { refreshZoonoses(); clearZoonoses(); setError(ombudsmanMessage(e)); }
      else if (invalidPath(e, "health_unit_id")) { setUnitError(ombudsmanMessage(e)); refreshUnits(); }
      else setError(anonymousOff(e) ? ANONYMOUS_DISABLED : ombudsmanMessage(e));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  if (mode === "sent") {
    return (
      <Screen title="Denúncia enviada" footer={<BigButton onClick={onBack}>Voltar ao início</BigButton>}>
        <p>Recebemos a sua denúncia. Ela será analisada pela Ouvidoria da Saúde.</p>
        <p>Como você não se identificou, não há protocolo nem acompanhamento por aqui.</p>
      </Screen>
    );
  }

  if (mode !== "form") {
    return (
      <Screen title="Denúncia anônima" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
        {mode === "loading" ? <p role="status">Carregando…</p> : <p>{ANONYMOUS_DISABLED}</p>}
      </Screen>
    );
  }

  return (
    <Screen title="Denúncia anônima"
      footer={<>
        <p style={warnNote}>{ANONYMOUS_WARNING}</p>
        <BigButton onClick={submit} disabled={busy}>Enviar denúncia</BigButton>
        <BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>
      </>}>
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <p style={warnNote}>{ANONYMOUS_WARNING}</p>
        <p style={{ margin: 0 }}>{`Use este caminho só para denúncias. Para reclamar, elogiar, sugerir ou pedir, faça uma manifestação${
          offPhone ? " na tela inicial do celular" : ""}.`}</p>
      </div>
      <UnitSelect units={units} value={unitId} disabled={busy} onChange={id => { setUnitId(id); setUnitError(null); }} />
      {unitError && <div style={{ marginBottom: 12 }}><ErrorText>{unitError}</ErrorText></div>}
      {zoonosesOn && (
        <>
          <RadioGroup legend={ZOONOSES_QUESTION} options={YES_NO_OPTIONS} value={aboutAnimals} disabled={busy}
            onChange={a => { if (a === "no") clearZoonoses(); setAboutAnimals(a); }} />
          {aboutAnimals === "yes" && (
            <>
              <div style={{ marginBottom: 12 }}><p style={warnNote}>{ZOONOSES_NOTICE}</p></div>
              <RadioGroup legend="Assunto" options={ZOONOSES_SUBTYPES} value={subtype} disabled={busy} error={subtypeError ?? undefined}
                onChange={t => { setSubtype(t as ZoonosesSubtype); setSubtypeError(null); }} />
              <Field ref={addressInput} label={ZOONOSES_ADDRESS_LABEL} autoComplete="off" value={placeAddress} readOnly={busy}
                error={addressError ?? undefined} onChange={e => { setPlaceAddress(e.target.value); setAddressError(null); }} />
            </>
          )}
        </>
      )}
      <TextArea ref={field} label="O que você quer denunciar?" hint={REPORT_HINT} max={BODY_MAX} value={text}
        readOnly={busy} error={fieldError ?? undefined} onChange={setText} />
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

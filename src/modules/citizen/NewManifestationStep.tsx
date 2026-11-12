// Nova manifestação (módulo 33; contrato §3, §14): uma pergunta por tela. O texto mora só no estado (nunca em storage, URL ou console).
// Quem manifesta (Q62): sem pessoa na sessão, CPF e nome (U1, sem o termo da triagem); com uma, ela mesma, sem tela de escolha;
// com várias, a escolha é obrigatória. Nunca "Outra pessoa".
import { useEffect, useRef, useState } from "react";
import {
  ApiError, citizenApi, type IdentificationMode, type ManifestationAuthor, type ManifestationKind, type Person
} from "../../lib/citizenApi";
import { fmtCalendarDate } from "../../lib/format";
import { isValidCpf, maskCpf, onlyDigits } from "../../lib/masks";
import { BODY_MAX, KIND_OPTIONS, MODE_OPTIONS, PRESERVED_HINT, bodyError, nameError, ombudsmanMessage } from "../../lib/ombudsman";
import { AttachmentPicker, TextArea, UnitSelect, type PickedAttachment } from "./OmbudsmanFields";
import { personLine } from "./PeopleStep";
import { BigButton, ErrorText, FROZEN_TEXT_NOTICE, Field, RadioGroup, Screen } from "./ui";

type Unit = { id: string; name: string };
type Mode = "loading" | "failed" | "identity" | "who" | "kind" | "mode" | "text" | "sent";
type Result = { id: string; protocol: string; due_on: string | null };

const WHO_TITLE = "Quem está fazendo a manifestação?";
const BAD_CPF = "CPF inválido. Confira os números.";
const linkStyle = { minHeight: 48, background: "none", border: "none", textDecoration: "underline", fontSize: 18, padding: 0,
  textAlign: "left", color: "var(--ink)" } as const;

const withHint = (o: { value: string; label: string; hint: string }) => ({ value: o.value, label: `${o.label} — ${o.hint}` });
const KINDS = KIND_OPTIONS.map(withHint);
const MODES = MODE_OPTIONS.map(withHint);

const invalidPath = (e: unknown, path: string) => e instanceof ApiError && e.code === "invalid_request" && e.path === path;
const isCode = (e: unknown, code: string) => e instanceof ApiError && e.code === code;

// O primeiro modo depende de quantas pessoas a sessão tem (Q62).
const firstMode = (people: Person[]): Mode => (people.length === 0 ? "identity" : people.length === 1 ? "kind" : "who");

export function NewManifestationStep({ onBack, onDone, onAnonymous }: {
  onBack: () => void; onDone: (id: string) => void; onAnonymous?: () => void;
}) {
  const [ mode, setMode ] = useState<Mode>("loading");
  const [ people, setPeople ] = useState<Person[]>([]);
  const [ units, setUnits ] = useState<Unit[]>([]);
  const [ anonymousWeb, setAnonymousWeb ] = useState(false);
  const [ citizenId, setCitizenId ] = useState<string | undefined>(undefined);
  const [ cpf, setCpf ] = useState("");
  const [ fullName, setFullName ] = useState("");
  const [ kind, setKind ] = useState<string | undefined>(undefined);
  const [ idMode, setIdMode ] = useState<string | undefined>(undefined);
  const [ healthUnitId, setHealthUnitId ] = useState<string | null>(null);
  const [ text, setText ] = useState("");
  const [ attachments, setAttachments ] = useState<PickedAttachment[]>([]);
  const [ result, setResult ] = useState<Result | null>(null);

  const [ whoError, setWhoError ] = useState<string | null>(null);
  const [ cpfError, setCpfError ] = useState<string | null>(null);
  const [ nameErr, setNameErr ] = useState<string | null>(null);
  const [ kindError, setKindError ] = useState<string | null>(null);
  const [ modeError, setModeError ] = useState<string | null>(null);
  const [ fieldError, setFieldError ] = useState<string | null>(null);
  const [ unitError, setUnitError ] = useState<string | null>(null);
  const [ attachError, setAttachError ] = useState<string | null>(null);
  const [ error, setError ] = useState<string | null>(null);
  const [ busy, setBusy ] = useState(false);

  const inFlight = useRef(false); // o estado só vale no próximo render; o ref fecha a porta no mesmo tick
  const alive = useRef(true);
  const field = useRef<HTMLTextAreaElement>(null);
  const cpfInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    alive.current = true;
    citizenApi.people().then(
      ({ people: list }) => {
        if (!alive.current) return;
        setPeople(list);
        if (list.length === 1) setCitizenId(list[0].id);
        setMode(firstMode(list));
      },
      e => { if (alive.current) { setError(ombudsmanMessage(e)); setMode("failed"); } }
    );
    citizenApi.ombudsmanPublicConfig().then(
      c => { if (alive.current) { setUnits(c.units); setAnonymousWeb(c.anonymous_web); } },
      () => { /* sem configuração: sem unidade e sem o caminho anônimo */ }
    );
    return () => { alive.current = false; };
  }, []);

  const start = firstMode(people);

  function go(to: Mode) {
    setError(null);
    setMode(to);
  }

  function continueIdentity() {
    const cpfBad = isValidCpf(cpf) ? null : BAD_CPF;
    const nameBad = nameError(fullName);
    setCpfError(cpfBad);
    setNameErr(nameBad);
    if (cpfBad) return cpfInput.current?.focus();
    if (nameBad) return nameInput.current?.focus();
    go("kind");
  }

  function continueWho() {
    if (!citizenId) return setWhoError("Escolha a pessoa.");
    go("kind");
  }

  function continueKind() {
    if (!kind) return setKindError("Escolha o tipo.");
    go("mode");
  }

  function continueMode() {
    if (!idMode) return setModeError("Escolha como se identificar.");
    go("text");
  }

  function failField(message: string) {
    setFieldError(message);
    field.current?.focus();
  }

  // A pessoa escolhida não vale mais (Q19): relê as pessoas e pede a escolha de novo, pela mesma regra da abertura (Q62).
  function refreshPeople(message: string) {
    citizenApi.people().then(
      ({ people: list }) => {
        if (!alive.current) return;
        setPeople(list);
        if (list.length === 1) { setCitizenId(list[0].id); setError(message); return; }
        setCitizenId(undefined);
        if (list.length === 0) { setMode("identity"); setError(message); return; }
        setWhoError(message);
        setMode("who");
      },
      () => { if (alive.current) setError(message); }
    );
  }

  // A unidade escolhida saiu da lista: volta a "Nenhuma unidade específica" e relê as unidades.
  function refreshUnits() {
    setHealthUnitId(null);
    citizenApi.ombudsmanPublicConfig().then(c => { if (alive.current) setUnits(c.units); }, () => { /* fica a lista que havia */ });
  }

  function failIdentity(set: (m: string) => void, message: string) {
    set(message);
    setMode("identity");
  }

  async function submit() {
    if (inFlight.current) return;
    setError(null); setFieldError(null); setUnitError(null); setAttachError(null);
    const local = bodyError(text);
    if (local) return failField(local);
    const who: ManifestationAuthor = people.length === 0
      ? { cpf: onlyDigits(cpf), fullName: fullName.trim() }
      : { citizenId: citizenId ?? "" };
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await citizenApi.createManifestation({
        who, kind: kind as ManifestationKind, mode: idMode as IdentificationMode, body: text.trim(),
        healthUnitId, attachmentIds: attachments.map(a => a.id)
      });
      if (!alive.current) return;
      setResult(r);
      setMode("sent");
    } catch (e) {
      if (!alive.current) return;
      const message = ombudsmanMessage(e);
      if (isCode(e, "not_own_citizen") || invalidPath(e, "citizen_id")) refreshPeople(message);
      else if (isCode(e, "invalid_cpf") || invalidPath(e, "cpf")) failIdentity(setCpfError, message);
      else if (invalidPath(e, "full_name")) failIdentity(setNameErr, message);
      else if (isCode(e, "too_many_people")) failIdentity(setError, message);
      else if (invalidPath(e, "body")) failField(bodyError(text) ?? message);
      else if (invalidPath(e, "health_unit_id")) { setUnitError(message); refreshUnits(); }
      else if (invalidPath(e, "attachment_ids") || isCode(e, "too_many_attachments")) setAttachError(message);
      else setError(message);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const nav = (onContinue: () => void, back: () => void) => (
    <>
      <BigButton onClick={onContinue}>Continuar</BigButton>
      <BigButton variant="secondary" onClick={back}>Voltar</BigButton>
    </>
  );
  const kindBack = () => (start === "kind" ? onBack() : go(start));

  if (mode === "loading" || mode === "failed") {
    return (
      <Screen title="Nova manifestação" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
        {mode === "loading" ? <p role="status">Carregando…</p> : error && <ErrorText>{error}</ErrorText>}
      </Screen>
    );
  }

  if (mode === "sent" && result) {
    return (
      <Screen title="Manifestação registrada" footer={<BigButton onClick={() => onDone(result.id)}>Ver minha manifestação</BigButton>}>
        <p>{`Protocolo ${result.protocol}`}</p>
        {result.due_on && <p>{`Resposta prevista até ${fmtCalendarDate(result.due_on)}`}</p>}
      </Screen>
    );
  }

  if (mode === "identity") {
    return (
      <Screen title={WHO_TITLE} footer={nav(continueIdentity, onBack)}>
        <Field ref={cpfInput} label="CPF" hint="11 números, está no documento" inputMode="numeric" autoComplete="off"
          value={cpf} error={cpfError ?? undefined} onChange={e => { setCpf(maskCpf(e.target.value)); setCpfError(null); }} />
        <Field ref={nameInput} label="Seu nome" autoComplete="off" value={fullName} error={nameErr ?? undefined}
          onChange={e => { setFullName(e.target.value); setNameErr(null); }} />
        {error && <ErrorText>{error}</ErrorText>}
      </Screen>
    );
  }

  if (mode === "who") {
    const options = people.map(p => {
      const line = personLine(p);
      return { value: p.id, label: line ? `CPF ${p.cpf_masked} · ${line}` : `CPF ${p.cpf_masked}` };
    });
    return (
      <Screen title={WHO_TITLE} footer={nav(continueWho, onBack)}>
        <RadioGroup legend="Pessoa deste celular" options={options} value={citizenId} error={whoError ?? undefined}
          onChange={id => { setCitizenId(id); setWhoError(null); }} />
        {error && <ErrorText>{error}</ErrorText>}
      </Screen>
    );
  }

  if (mode === "kind") {
    return (
      <Screen title="Que tipo de manifestação?" footer={nav(continueKind, kindBack)}>
        <RadioGroup legend="Tipo de manifestação" options={KINDS} value={kind} error={kindError ?? undefined}
          onChange={k => { setKind(k); setKindError(null); }} />
        {kind === "report" && onAnonymous && anonymousWeb && (
          <button type="button" style={linkStyle} onClick={onAnonymous}>Prefere não se identificar? Faça uma denúncia anônima</button>
        )}
      </Screen>
    );
  }

  if (mode === "mode") {
    return (
      <Screen title="Como você quer se identificar?" footer={nav(continueMode, () => go("kind"))}>
        <RadioGroup legend="Forma de identificação" options={MODES} value={idMode} error={modeError ?? undefined}
          onChange={m => { setIdMode(m); setModeError(null); }} />
      </Screen>
    );
  }

  return (
    <Screen title="Sua manifestação"
      footer={<>
        <BigButton onClick={submit} disabled={busy}>Enviar manifestação</BigButton>
        <BigButton variant="secondary" onClick={() => go("mode")}>Voltar</BigButton>
      </>}>
      <UnitSelect units={units} value={healthUnitId} onChange={id => { setHealthUnitId(id); setUnitError(null); }} />
      {unitError && <div style={{ marginBottom: 12 }}><ErrorText>{unitError}</ErrorText></div>}
      <TextArea ref={field} label="Conte o que aconteceu" hint={idMode === "preserved" ? PRESERVED_HINT : FROZEN_TEXT_NOTICE}
        max={BODY_MAX} value={text} error={fieldError ?? undefined} onChange={setText} />
      <AttachmentPicker items={attachments} disabled={busy} onChange={items => { setAttachments(items); setAttachError(null); }} />
      {attachError && <div style={{ marginBottom: 12 }}><ErrorText>{attachError}</ErrorText></div>}
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

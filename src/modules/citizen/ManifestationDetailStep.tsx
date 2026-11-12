// Detalhe de uma manifestação (módulo 33; contrato §3, §10, §14; Q2, Q4, Q19, Q42, Q45). A tela desenha campo a campo só o que
// o cidadão pode ver: nunca o encaminhamento, o extrato, o assunto interno nem quem respondeu. Anexos como "Anexo N" (Q2).
// Ações uma de cada vez: complemento, pedido de reabertura, pesquisa. Cada envio aceito relê o detalhe; sem polling.
// O texto digitado mora só no estado do React.
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ApiError, TIMELINE_TEXT_KINDS, citizenApi, type CitizenManifestation } from "../../lib/citizenApi";
import { fmtDateTime } from "../../lib/format";
import {
  PRESERVED_HINT, REASON_MAX, SATISFACTION, TEXT_MAX, complementError, deadlineText, kindLabel, ombudsmanMessage, reasonError,
  timelineTitle
} from "../../lib/ombudsman";
import { AttachmentPicker, TextArea, type PickedAttachment } from "./OmbudsmanFields";
import { StatePill } from "./MyManifestationsStep";
import { BigButton, ErrorText, FROZEN_TEXT_NOTICE, RadioGroup, Screen } from "./ui";

type Action = "complement" | "reopen" | "satisfaction";
type Question = "met" | "clear" | "score";
type ReadResult = { status: "ok" } | { status: "stale" } | { status: "failed"; error: unknown };

const UPLOAD_WAIT = "Aguarde o anexo terminar de subir.";
const ANSWER_ALL = "Responda as três perguntas.";
const FLAG = { complement: "can_complement", reopen: "can_request_reopen", satisfaction: "can_answer_satisfaction" } as const;
const DONE: Record<Action, string> = {
  complement: "Complemento enviado.",
  reopen: "Pedido de reabertura enviado.",
  satisfaction: "Obrigado por responder."
};

// Recusas pelo estado da manifestação (F-11): o formulário fecha, a frase fica fora dele e o detalhe é relido uma vez.
// As demais (campo, anexo, 429…) deixam o formulário aberto, com o texto.
const STATE_CONFLICTS = new Set([
  "manifestation_changed", "invalid_transition", "reopen_window_closed", "reopen_pending", "reopen_already_requested",
  "already_answered", "satisfaction_window_closed", "not_found"
]);

const isCode = (e: unknown, code: string) => e instanceof ApiError && e.code === code;
const invalidPath = (e: unknown, path: string) => isCode(e, "invalid_request") && (e as ApiError).path === path;
const isConflict = (e: unknown) => e instanceof ApiError && STATE_CONFLICTS.has(e.code);

export function ManifestationDetailStep({ manifestationId, onBack, onRead }: {
  manifestationId: string; onBack: () => void; onRead?: () => void;
}) {
  const [ detail, setDetail ] = useState<CitizenManifestation | null>(null);
  const [ failure, setFailure ] = useState<string | null>(null); // sem detalhe para mostrar (404, 403, rede): só Voltar
  const [ open, setOpen ] = useState<Action | null>(null);
  const [ notice, setNotice ] = useState<string | null>(null);
  const [ error, setError ] = useState<string | null>(null); // fora do formulário
  const [ formError, setFormError ] = useState<string | null>(null);
  const [ fieldError, setFieldError ] = useState<string | null>(null);
  const [ attachError, setAttachError ] = useState<string | null>(null);
  const [ text, setText ] = useState("");
  const [ reason, setReason ] = useState("");
  const [ attachments, setAttachments ] = useState<PickedAttachment[]>([]);
  const [ answers, setAnswers ] = useState<Partial<Record<Question, string>>>({});
  const [ missing, setMissing ] = useState<Question | null>(null);
  const [ busy, setBusy ] = useState(false);
  const [ uploading, setUploading ] = useState(false); // anexo ainda subindo: enviar agora o deixaria de fora
  const [ settled, setSettled ] = useState(0); // conta as ações encerradas (aceitas ou em conflito): leva o foco ao resultado

  const alive = useRef(true);
  const seq = useRef(0); // só a leitura mais recente escreve
  const inFlight = useRef(false); // o estado só vale no próximo render; o ref fecha a porta no mesmo tick
  const onReadRef = useRef(onRead);
  const field = useRef<HTMLTextAreaElement>(null);
  const surveyHeading = useRef<HTMLHeadingElement>(null);
  const triggers = useRef<Partial<Record<Action, HTMLButtonElement | null>>>({});
  const refocus = useRef<Action | null>(null); // a ação cancelada: o foco volta ao botão dela
  const result = useRef<HTMLDivElement>(null);
  const uid = useId(); // prefixo dos ids da tela

  useEffect(() => { onReadRef.current = onRead; });

  const read = useCallback(async (): Promise<ReadResult> => {
    const mine = ++seq.current;
    try {
      const d = await citizenApi.manifestation(manifestationId);
      if (!alive.current || mine !== seq.current) return { status: "stale" };
      setDetail(d);
      return { status: "ok" };
    } catch (e) {
      if (!alive.current || mine !== seq.current) return { status: "stale" };
      return { status: "failed", error: e };
    }
  }, [ manifestationId ]);

  useEffect(() => {
    alive.current = true;
    void read().then(r => {
      // Q45: o GET do detalhe marcou os avisos como lidos; quem chamou atualiza o selo do topo.
      if (r.status === "ok") onReadRef.current?.();
      else if (r.status === "failed") setFailure(ombudsmanMessage(r.error));
    });
    return () => { alive.current = false; };
  }, [ read ]);

  // Foco: o campo (ou a pergunta) ao abrir; o botão que abriu, ao cancelar.
  useEffect(() => {
    if (open === "satisfaction") surveyHeading.current?.focus();
    else if (open) field.current?.focus();
    else if (refocus.current) triggers.current[refocus.current]?.focus();
    refocus.current = null;
  }, [ open ]);

  // Depois de uma ação aceita ou em conflito o formulário some (e o botão que o abriu, em geral, também): o foco vai à frase
  // do resultado. Se a manifestação sumiu (404), a tela troca de título e o Screen põe o foco no h1.
  useEffect(() => { if (settled > 0) result.current?.focus(); }, [ settled ]);

  // Relê depois de uma ação. Sumiu (404, Q19): só Voltar. Outra falha: a frase fica fora do formulário, se não houver outra.
  // Devolve true quando a releitura falhou e o detalhe na tela ficou o antigo.
  async function reread(keepError: boolean): Promise<boolean> {
    const r = await read();
    if (r.status !== "failed") return false;
    if (isCode(r.error, "not_found")) { setFailure(ombudsmanMessage(r.error)); return false; }
    if (!keepError) setError(ombudsmanMessage(r.error));
    return true;
  }

  function clearMessages() {
    setNotice(null); setError(null); setFormError(null); setFieldError(null); setAttachError(null); setMissing(null);
  }

  function openAction(action: Action) {
    clearMessages();
    setText(""); setReason(""); setAttachments([]); setAnswers({});
    setOpen(action);
  }

  function cancel() {
    clearMessages();
    refocus.current = open;
    setOpen(null);
  }

  function failField(message: string) {
    setFieldError(message);
    field.current?.focus();
  }

  // `fieldFailure` diz se a recusa é de campo (já mostrada no formulário); senão, e se não for conflito, vai ao pé do formulário.
  async function run(action: Action, send: () => Promise<void>, fieldFailure: (e: unknown) => boolean) {
    inFlight.current = true;
    setBusy(true);
    try {
      await send();
      if (!alive.current) return;
      setOpen(null);
      const stale = await reread(false);
      if (!alive.current) return;
      // O detalhe na tela é o de antes do envio: a ação já feita não pode ser oferecida de novo.
      if (stale) setDetail(d => d && { ...d, [FLAG[action]]: false });
      setNotice(DONE[action]);
      setSettled(n => n + 1);
    } catch (e) {
      if (!alive.current) return;
      if (isConflict(e)) {
        setOpen(null);
        setError(ombudsmanMessage(e));
        await reread(true);
        if (alive.current) setSettled(n => n + 1);
      } else if (!fieldFailure(e)) setFormError(ombudsmanMessage(e));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function sendComplement() {
    if (inFlight.current || uploading) return;
    clearMessages();
    const local = complementError(text);
    if (local) return failField(local);
    void run("complement",
      () => citizenApi.complementManifestation(manifestationId, { body: text.trim(), attachmentIds: attachments.map(a => a.id) }),
      e => {
        if (invalidPath(e, "body")) { failField(complementError(text) ?? ombudsmanMessage(e)); return true; }
        if (invalidPath(e, "attachment_ids") || isCode(e, "too_many_attachments") || isCode(e, "invalid_file")) {
          setAttachError(ombudsmanMessage(e));
          return true;
        }
        return false;
      });
  }

  function sendReopen() {
    if (inFlight.current) return;
    clearMessages();
    const local = reasonError(reason);
    if (local) return failField(local);
    void run("reopen", () => citizenApi.requestReopen(manifestationId, reason.trim()), e => {
      if (invalidPath(e, "reason")) { failField(reasonError(reason) ?? ombudsmanMessage(e)); return true; }
      return false;
    });
  }

  function sendSurvey() {
    if (inFlight.current) return;
    clearMessages();
    const { met, clear, score } = answers;
    const empty = !met ? "met" : !clear ? "clear" : !score ? "score" : null;
    if (empty) return setMissing(empty);
    // O RadioGroup só trabalha com string: o api quer boolean e inteiro JSON (record_satisfaction.rb:18-20).
    void run("satisfaction", () => citizenApi.answerSatisfaction(manifestationId, {
      met: met as "yes" | "partly" | "no", clear: clear === "true", score: Number(score)
    }), () => false);
  }

  function answer(q: Question, value: string) {
    setAnswers(a => ({ ...a, [q]: value }));
    if (missing === q) setMissing(null);
  }

  const back = <BigButton variant="secondary" onClick={onBack}>Voltar às manifestações</BigButton>;

  if (failure || !detail) {
    return (
      <Screen title="Manifestação" footer={back}>
        {failure ? <ErrorText>{failure}</ErrorText> : <p role="status">Carregando…</p>}
      </Screen>
    );
  }

  const m = detail;
  const deadline = deadlineText(m); // com a cor do próprio detalhe (Q42)
  const textHint = m.identification_mode === "preserved" ? PRESERVED_HINT : FROZEN_TEXT_NOTICE;
  const formButtons = (submitLabel: string, onSubmit: () => void, extra?: { disabled: boolean; describedBy?: string }) => (
    <div style={{ display: "grid", gap: 12 }}>
      {formError && <ErrorText>{formError}</ErrorText>}
      <BigButton onClick={onSubmit} disabled={busy || Boolean(extra?.disabled)} aria-describedby={extra?.describedBy}>{submitLabel}</BigButton>
      <BigButton variant="secondary" disabled={busy} onClick={cancel}>Cancelar</BigButton>
    </div>
  );
  const trigger = (action: Action, label: string) => (
    <BigButton ref={el => { triggers.current[action] = el; }} disabled={busy} onClick={() => openAction(action)}>{label}</BigButton>
  );

  return (
    <Screen title={`Manifestação ${m.protocol}`} footer={back}>
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <strong>{kindLabel(m.kind)}</strong>
        <div><StatePill state={m.state} /></div>
        {deadline && <p style={p}>{deadline}</p>}
        {m.health_unit && <p style={p}>Unidade de saúde: <span>{m.health_unit.name}</span></p>}
      </div>

      <section aria-labelledby={`${uid}-body`} style={section}>
        <h2 id={`${uid}-body`} style={h2}>O que você escreveu</h2>
        <p style={{ ...p, ...longText }}>{m.body}</p>
      </section>

      {m.attachments.length > 0 && (
        <section aria-labelledby={`${uid}-files`} style={section}>
          <h2 id={`${uid}-files`} style={h2}>Anexos</h2>
          <ul style={list}>{m.attachments.map((a, i) => <li key={a.id}>{`Anexo ${i + 1}`}</li>)}</ul>
        </section>
      )}

      <section style={section}>
        <h2 id={`${uid}-timeline`} style={h2}>Andamento</h2>
        <ol aria-labelledby={`${uid}-timeline`} style={{ ...list, gap: 12 }}>
          {m.timeline.map((t, i) => (
            <li key={`${t.kind}-${t.at}-${i}`} style={step}>
              <strong style={block}>{timelineTitle(t.kind)}</strong>
              <span style={{ ...block, color: "var(--ink2)" }}>{fmtDateTime(t.at)}</span>
              {/* Texto só nos kinds que o levam ao cidadão (o cliente já descarta; aqui é a segunda trava). */}
              {t.text && TIMELINE_TEXT_KINDS.has(t.kind) && <p style={{ ...p, ...longText }}>{t.text}</p>}
            </li>
          ))}
        </ol>
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        {(notice || error) && (
          <div ref={result} tabIndex={-1} style={{ display: "grid", gap: 12 }}>
            {notice && <p role="status" style={p}>{notice}</p>}
            {error && <ErrorText>{error}</ErrorText>}
          </div>
        )}

        {!open && m.can_complement && trigger("complement", "Enviar complemento")}
        {!open && m.can_request_reopen && trigger("reopen", "Pedir reabertura")}
        {!open && m.can_answer_satisfaction && trigger("satisfaction", "Responder a pesquisa")}

        {open === "complement" && (
          <section aria-label="Enviar complemento">
            <TextArea ref={field} label="Seu complemento" hint={textHint} max={TEXT_MAX} value={text} error={fieldError ?? undefined}
              readOnly={busy} onChange={v => { setText(v); setFieldError(null); }} />
            {/* Desligado enquanto um upload corre: um só por vez, e o envio espera o anexo (padrão da Task 5). */}
            <AttachmentPicker items={attachments} disabled={busy || uploading} onBusy={setUploading}
              onChange={items => { setAttachments(items); setAttachError(null); }} />
            {attachError && <div style={{ marginBottom: 12 }}><ErrorText>{attachError}</ErrorText></div>}
            {uploading && <p id={uid} style={{ ...p, marginBottom: 12 }}>{UPLOAD_WAIT}</p>}
            {formButtons("Enviar o complemento", sendComplement, { disabled: uploading, describedBy: uploading ? uid : undefined })}
          </section>
        )}

        {open === "reopen" && (
          <section aria-label="Pedir reabertura">
            <TextArea ref={field} label="Por que você quer reabrir?" hint={textHint} max={REASON_MAX} value={reason}
              error={fieldError ?? undefined} readOnly={busy} onChange={v => { setReason(v); setFieldError(null); }} />
            {formButtons("Enviar o pedido", sendReopen)}
          </section>
        )}

        {open === "satisfaction" && (
          <section aria-labelledby={`${uid}-survey`}>
            <h2 id={`${uid}-survey`} ref={surveyHeading} tabIndex={-1} style={{ ...h2, marginBottom: 12 }}>Pesquisa de satisfação</h2>
            {(Object.keys(SATISFACTION) as Question[]).map(q => (
              <RadioGroup key={q} legend={SATISFACTION[q].question} options={SATISFACTION[q].options} value={answers[q]}
                disabled={busy} error={missing === q ? ANSWER_ALL : undefined} onChange={v => answer(q, v)} />
            ))}
            {formButtons("Enviar respostas", sendSurvey)}
          </section>
        )}
      </div>
    </Screen>
  );
}

const p: CSSProperties = { margin: 0 };
const block: CSSProperties = { display: "block" };
const longText: CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
const section: CSSProperties = { display: "grid", gap: 8, marginBottom: 16 };
const h2: CSSProperties = { fontSize: "1.1rem", margin: 0 };
const list: CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 };
const step: CSSProperties = { borderLeft: "3px solid var(--rule2)", paddingLeft: 12, display: "grid", gap: 2 };

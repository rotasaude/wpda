// Campos da Ouvidoria (módulo 33): texto longo, unidade opcional e anexos. Peças locais: nenhum componente comum de ui.tsx muda.
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { ErrorText } from "./ui";
import { ApiError, citizenApi } from "../../lib/citizenApi";
import {
  ATTACHMENT_TYPES, MAX_ATTACHMENTS, attachmentError, attachmentFilename, ombudsmanMessage, readAsBase64, textLength
} from "../../lib/ombudsman";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const hintStyle = { margin: 0, fontSize: 15, color: "var(--ink2)" } as const;
const linkStyle = { minHeight: 48, background: "none", border: "none", textDecoration: "underline", fontSize: 18 } as const;

// Sem `maxLength` nativo: ele conta UTF-16, o api conta code points depois do strip (W9).
// `ref` chega ao textarea: a tela foca o campo depois de um erro dele (WP-07).
export const TextArea = forwardRef<HTMLTextAreaElement, {
  label: string; hint?: string; error?: string; value: string; onChange: (v: string) => void; max: number; disabled?: boolean;
  readOnly?: boolean; // durante o envio: o texto não muda, mas o campo ainda recebe o foco de um erro dele
}>(function TextArea({ label, hint, error, value, onChange, max, disabled, readOnly }, ref) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [ hint ? hintId : null, error ? errorId : null ].filter(Boolean).join(" ") || undefined;
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
      <label htmlFor={id} style={{ fontWeight: 600 }}>{label}</label>
      <textarea id={id} ref={ref} rows={6} value={value} disabled={disabled} readOnly={readOnly} aria-invalid={Boolean(error)} aria-describedby={describedBy}
        onChange={e => onChange(e.target.value)}
        style={{ minHeight: 160, fontSize: 18, padding: 12, borderRadius: 12, resize: "vertical",
          border: `2px solid ${error ? "var(--down)" : "var(--rule2)"}` }} />
      <p aria-live="polite" style={{ ...hintStyle, textAlign: "right" }}>{`${fmt(textLength(value))} de ${fmt(max)}`}</p>
      {hint && <p id={hintId} style={hintStyle}>{hint}</p>}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
});

export function UnitSelect({ units, value, onChange }: {
  units: { id: string; name: string }[]; value: string | null; onChange: (id: string | null) => void;
}) {
  const id = useId();
  if (units.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
      <label htmlFor={id} style={{ fontWeight: 600 }}>Unidade de saúde (opcional)</label>
      <select id={id} value={value ?? ""} onChange={e => onChange(e.target.value || null)}
        style={{ minHeight: 56, fontSize: 18, padding: "0 12px", borderRadius: 12, border: "2px solid var(--rule2)" }}>
        <option value="">Nenhuma unidade específica</option>
        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </div>
  );
}

// Só o id: o nome do arquivo nunca é guardado nem mostrado (Q2).
export interface PickedAttachment { id: string }

const UPLOAD_REFUSED = "Envie um PDF, uma foto JPEG ou PNG, de até 10 MB.";
const UPLOAD_CODES = new Set([ "http_413", "payload_too_large", "invalid_file", "invalid_request" ]);

// `onBusy`: avisa quando um upload começa e termina, para a tela não enviar sem o anexo que ainda sobe.
export function AttachmentPicker({ items, onChange, disabled, onBusy }: {
  items: PickedAttachment[]; onChange: (items: PickedAttachment[]) => void; disabled?: boolean; onBusy?: (busy: boolean) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const alive = useRef(true);
  const lock = useRef(false); // o estado só vale no próximo render; o ref fecha a porta no mesmo tick
  const [ busy, setBusy ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function pick(file: File | undefined) {
    if (!file || lock.current) return;
    const refused = attachmentError(file, items.length);
    if (refused) { setError(refused); return; }
    setError(null);
    lock.current = true;
    setBusy(true);
    onBusy?.(true);
    try {
      const data = await readAsBase64(file);
      if (!alive.current) return;
      const { id: attachmentId } = await citizenApi.uploadOmbudsmanAttachment({
        filename: attachmentFilename(items.length, file.type), contentType: file.type, data
      });
      if (!alive.current) return;
      onChange([ ...items, { id: attachmentId } ]);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof ApiError && UPLOAD_CODES.has(e.code) ? UPLOAD_REFUSED : ombudsmanMessage(e));
    } finally {
      lock.current = false;
      onBusy?.(false); // também depois do desmonte: a tela segue montada e não pode ficar presa
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
      {items.length < MAX_ATTACHMENTS && (
        <>
          <label htmlFor={id} style={{ fontWeight: 600 }}>Anexar arquivo (opcional)</label>
          <input id={id} type="file" accept={Object.keys(ATTACHMENT_TYPES).join(",")} disabled={disabled || busy}
            aria-describedby={hintId} style={{ minHeight: 48, fontSize: 18 }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; void pick(f); }} />
          <p id={hintId} style={hintStyle}>Até 3 arquivos, PDF, JPEG ou PNG, de até 10 MB cada.</p>
        </>
      )}
      {busy && <p role="status" style={{ margin: 0 }}>Enviando o anexo…</p>}
      {error && <ErrorText>{error}</ErrorText>}
      {items.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {items.map((a, i) => (
            <li key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48 }}>
              <span>{`Anexo ${i + 1}`}</span>
              <button type="button" disabled={disabled || busy} style={linkStyle} aria-label={`Remover Anexo ${i + 1}`}
                onClick={() => { setError(null); onChange(items.filter(x => x.id !== a.id)); }}>Remover</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

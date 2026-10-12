// src/modules/citizen/MyHistoryStep.tsx
// "Meu histórico" de uma pessoa do celular (módulo 20, F-20.4 e F-20.5; spec
// §2, §4 e §8; contrato §2 e §4). Par validado: resumo de saúde (quando
// houver), documentos com o PDF e o código de conferência, e a linha do
// tempo. Par só declarado: as próprias triagens e agendamentos e o convite
// para validar. O que o par vê é do api; a tela nem pede resumo ou
// documentos para par declarado.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  citizenApi, ApiError, DOCUMENT_KINDS, type CitizenDocumentRef, type CitizenEntry, type CitizenHistory, type HealthSummary
} from "../../lib/citizenApi";
import {
  DOCUMENT_GONE, NOT_VERIFIED_INVITE, PARTIAL_NOTICE, SUMMARY_EMPTY, citizenKindLabel, citizenStatusLabel, documentFilename,
  entryPlace, mergeEntries, sinceText, vitalsLines
} from "../../lib/history";
import { fmtDate, fmtDateTime } from "../../lib/format";
import { BigButton, ErrorText, Screen, messageFor, pdfMessageFor } from "./ui";

const PDF_URL_TTL_MS = 60_000;

type ListKey = "timeline" | "documents";

export function MyHistoryStep({ citizenId, onBack, onValidate }:
  { citizenId: string; onBack: () => void; onValidate: (citizenId: string) => void }) {
  const [timeline, setTimeline] = useState<CitizenHistory | null>(null);
  const [documents, setDocuments] = useState<CitizenHistory | null>(null);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState<ListKey | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  // O erro do download aparece no cartão do documento, na seção de onde veio o toque.
  const [downloadError, setDownloadError] = useState<{ list: ListKey; docId: string; message: string } | null>(null);
  // O erro do "Carregar mais" aparece junto do próprio botão.
  const [moreError, setMoreError] = useState<{ list: ListKey; message: string } | null>(null);
  // A tela pode sair enquanto o PDF baixa: sem tela, nada de endereço blob nem clique.
  const mounted = useRef(true);
  const pendingUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    mounted.current = true;
    const pending = pendingUrls.current;
    return () => {
      mounted.current = false;
      pending.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); });
      pending.clear();
    };
  }, []);

  useEffect(() => {
    // StrictMode monta duas vezes em dev: a resposta da montagem desfeita não escreve.
    let alive = true;
    citizenApi.history(citizenId)
      .then((h) => {
        if (!alive) return;
        setTimeline(h);
        if (!h.verified) return;
        citizenApi.healthSummary(citizenId)
          .then((s) => { if (alive) setSummary(s); })
          // Sem prontuário (modo integrado) ou sem paciente: só não há resumo.
          .catch((e) => { if (alive && !(e instanceof ApiError && e.code === "not_available")) setError(messageFor(e)); });
        citizenApi.history(citizenId, { kinds: DOCUMENT_KINDS })
          .then((d) => { if (alive) setDocuments(d); })
          .catch((e) => { if (alive) setError(messageFor(e)); });
      })
      .catch((e) => { if (alive) setError(messageFor(e)); });
    return () => { alive = false; };
  }, [citizenId]);

  async function loadMore(list: ListKey) {
    const current = list === "timeline" ? timeline : documents;
    if (!current?.next_before || more) return;
    setMore(list); setMoreError(null);
    try {
      const next = await citizenApi.history(citizenId,
        list === "timeline" ? { before: current.next_before } : { before: current.next_before, kinds: DOCUMENT_KINDS });
      if (!mounted.current) return;
      const merged = { ...current, entries: mergeEntries(current.entries, next.entries), next_before: next.next_before };
      if (list === "timeline") setTimeline(merged); else setDocuments(merged);
    } catch (e) {
      if (mounted.current) setMoreError({ list, message: messageFor(e) });
    } finally {
      if (mounted.current) setMore(null);
    }
  }

  async function download(doc: CitizenDocumentRef, list: ListKey) {
    if (downloading) return;
    setDownloading(doc.id); setDownloadError(null);
    try {
      const blob = await citizenApi.documentPdf(doc.id);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = documentFilename(doc);
      a.click();
      const pending = pendingUrls.current;
      pending.set(url, setTimeout(() => { pending.delete(url); URL.revokeObjectURL(url); }, PDF_URL_TTL_MS));
    } catch (e) {
      if (!mounted.current) return;
      // 429 do PDF tem frase própria (pdfMessageFor), não a do SMS.
      setDownloadError({ list, docId: doc.id,
        message: e instanceof ApiError && e.code === "not_found" ? DOCUMENT_GONE : pdfMessageFor(e) });
    } finally {
      if (mounted.current) setDownloading(null);
    }
  }

  return (
    <Screen title="Meu histórico" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
      {error && <ErrorText>{error}</ErrorText>}
      {!timeline && !error && <p>Carregando…</p>}
      {timeline && (
        <div style={{ display: "grid", gap: 24 }}>
          {timeline.partial && <p role="note" aria-label="histórico parcial" style={notice}>{PARTIAL_NOTICE}</p>}
          {!timeline.verified && (
            <div style={{ display: "grid", gap: 12 }}>
              <p role="note" aria-label="cadastro não validado" style={notice}>{NOT_VERIFIED_INVITE}</p>
              <BigButton onClick={() => onValidate(citizenId)}>Validar no posto</BigButton>
            </div>
          )}
          {timeline.verified && summary && <SummarySection summary={summary} />}
          {timeline.verified && documents && (
            <section aria-label="Documentos">
              <h2 style={h2}>Documentos</h2>
              {documents.entries.length === 0 && <p>Nenhum documento ainda.</p>}
              <EntryList entries={documents.entries} downloading={downloading}
                downloadError={downloadError?.list === "documents" ? downloadError : null}
                onDownload={(doc) => void download(doc, "documents")} />
              {documents.next_before && (
                <LoadMore busy={more !== null} error={moreError?.list === "documents" ? moreError.message : null}
                  onClick={() => void loadMore("documents")} />
              )}
            </section>
          )}
          <section aria-label="Linha do tempo">
            <h2 style={h2}>Linha do tempo</h2>
            {timeline.entries.length === 0 && <p>Nenhum registro ainda.</p>}
            <EntryList entries={timeline.entries} downloading={downloading}
              downloadError={downloadError?.list === "timeline" ? downloadError : null}
              onDownload={(doc) => void download(doc, "timeline")} />
            {timeline.next_before && (
              <LoadMore busy={more !== null} error={moreError?.list === "timeline" ? moreError.message : null}
                onClick={() => void loadMore("timeline")} />
            )}
          </section>
        </div>
      )}
    </Screen>
  );
}

function SummarySection({ summary }: { summary: HealthSummary }) {
  const vitals = vitalsLines(summary.vitals);
  return (
    <section aria-label="Resumo de saúde">
      <h2 style={h2}>Resumo de saúde</h2>
      <h3 style={h3}>Problemas de saúde</h3>
      {summary.problems.length === 0 ? <p>{SUMMARY_EMPTY.problems}</p> : (
        <ul style={list}>
          {summary.problems.map((p) => (
            <li key={`${p.terminology}:${p.code}`}>
              <div>{p.label}</div>
              {sinceText(p.since) && <div style={muted}>{sinceText(p.since)}</div>}
            </li>
          ))}
        </ul>
      )}
      <h3 style={h3}>Medicamentos em uso</h3>
      {summary.medications.length === 0 ? <p>{SUMMARY_EMPTY.medications}</p> : (
        <ul style={list}>
          {summary.medications.map((m, i) => (
            <li key={`${m.label}-${i}`}>{m.dosage_summary ? `${m.label} — ${m.dosage_summary}` : m.label}</li>
          ))}
        </ul>
      )}
      <h3 style={h3}>Exames pedidos nos últimos 12 meses</h3>
      {summary.exam_requests.length === 0 ? <p>{SUMMARY_EMPTY.exam_requests}</p> : (
        <ul style={list}>
          {summary.exam_requests.map((x, i) => (
            <li key={`${x.sigtap_code}-${i}`}>{`${x.label} — pedido em ${fmtDate(x.requested_at)}`}</li>
          ))}
        </ul>
      )}
      <h3 style={h3}>Últimas medidas</h3>
      {vitals.length === 0 ? <p>{SUMMARY_EMPTY.vitals}</p> : (
        <ul style={list}>{vitals.map((line) => <li key={line}>{line}</li>)}</ul>
      )}
    </section>
  );
}

function LoadMore({ busy, error, onClick }: { busy: boolean; error: string | null; onClick: () => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {error && <ErrorText>{error}</ErrorText>}
      <BigButton variant="secondary" disabled={busy} onClick={onClick}>Carregar mais</BigButton>
    </div>
  );
}

function EntryList({ entries, downloading, downloadError, onDownload }:
  { entries: CitizenEntry[]; downloading: string | null; downloadError: { docId: string; message: string } | null;
    onDownload: (doc: CitizenDocumentRef) => void }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gap: 12 }}>
      {entries.map((e) => {
        const place = entryPlace(e);
        const status = citizenStatusLabel(e.status);
        return (
          <li key={e.id} style={card}>
            <strong>{citizenKindLabel(e.kind)}</strong>
            <div>{fmtDateTime(e.occurred_at)}</div>
            <div>{e.title}</div>
            {e.summary && <div style={muted}>{e.summary}</div>}
            {place && <div style={muted}>{place}</div>}
            {status && <div>{status}</div>}
            {e.document && (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {e.document.short_code && <div>{`Código de conferência: ${e.document.short_code}`}</div>}
                {e.document.verification_url && e.document.short_code && (
                  <a href={e.document.verification_url} style={link}>{`Conferir o documento ${e.document.short_code}`}</a>
                )}
                {e.document.downloadable && (
                  <BigButton variant="secondary" disabled={downloading !== null}
                    aria-busy={downloading === e.document.id}
                    aria-label={downloading === e.document.id ? `Baixando PDF de ${e.title}` : `Baixar PDF de ${e.title}`}
                    onClick={() => onDownload(e.document as CitizenDocumentRef)}>
                    {downloading === e.document.id ? "Baixando…" : "Baixar PDF"}
                  </BigButton>
                )}
                {downloadError?.docId === e.document.id && <ErrorText>{downloadError.message}</ErrorText>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const notice: CSSProperties = { background: "var(--warnBg, #fff4e0)", padding: 12, borderRadius: 12, margin: 0 };
const h2: CSSProperties = { fontSize: 20, margin: "0 0 12px" };
const h3: CSSProperties = { fontSize: 18, margin: "16px 0 8px" };
const list: CSSProperties = { margin: 0, paddingLeft: 20, display: "grid", gap: 8 };
const card: CSSProperties = { border: "1px solid var(--rule2, #ccc)", borderRadius: 12, padding: 12, display: "grid", gap: 4 };
const muted: CSSProperties = { color: "var(--ink2, #555)" };
const link: CSSProperties = { display: "inline-block", minHeight: 48, lineHeight: "48px", fontSize: 18 };

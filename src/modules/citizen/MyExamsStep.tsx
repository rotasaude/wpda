// src/modules/citizen/MyExamsStep.tsx
// "Meus exames" de uma pessoa do celular (módulo 21a, F-21.10; spec §6
// "Cidadão"; contrato §9). Só par validado: o par declarado vê o convite para
// validar e nenhum exame. A política do laudo é do api; a tela mostra a
// situação, a marcação e o que `result` oferece. Nunca motivo de negação,
// marca de crítico ou valores: só os campos do contrato são desenhados.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { citizenApi, ApiError, type CitizenExam, type CitizenExams } from "../../lib/citizenApi";
import {
  EXAMS_DISABLED, EXAMS_EMPTY, EXAMS_NOT_VERIFIED, EXAM_PDF_GONE, examFilename, examRequestedText, examResultView,
  examScheduleText, mergeExams
} from "../../lib/exams";
import { BigButton, ErrorText, Screen, messageFor, pdfMessageFor } from "./ui";

const PDF_URL_TTL_MS = 60_000;
const NOT_VERIFIED: CitizenExams = { verified: false, exams: [], next_before: null };

function listMessage(e: unknown): string {
  return e instanceof ApiError && e.code === "feature_disabled" ? EXAMS_DISABLED : messageFor(e);
}

function pdfMessage(e: unknown): string {
  if (e instanceof ApiError && e.code === "not_found") return EXAM_PDF_GONE;
  if (e instanceof ApiError && e.code === "feature_disabled") return EXAMS_DISABLED;
  // 429 do PDF tem frase própria (pdfMessageFor), não a do SMS.
  return pdfMessageFor(e);
}

export function MyExamsStep({ citizenId, onBack, onValidate }:
  { citizenId: string; onBack: () => void; onValidate: (citizenId: string) => void }) {
  const [data, setData] = useState<CitizenExams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ examId: string; message: string } | null>(null);
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
    citizenApi.exams(citizenId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        if (!alive) return;
        // Api que recusa o par declarado com 403 em vez de verified:false: o mesmo convite.
        if (e instanceof ApiError && e.code === "not_verified") setData(NOT_VERIFIED);
        else setError(listMessage(e));
      });
    return () => { alive = false; };
  }, [citizenId]);

  async function loadMore() {
    if (!data?.next_before || more) return;
    setMore(true); setMoreError(null);
    try {
      const next = await citizenApi.exams(citizenId, { before: data.next_before });
      if (!mounted.current) return;
      setData({ ...data, exams: mergeExams(data.exams, next.exams), next_before: next.next_before });
    } catch (e) {
      if (mounted.current) setMoreError(listMessage(e));
    } finally {
      if (mounted.current) setMore(false);
    }
  }

  async function download(exam: CitizenExam) {
    // Só pede o PDF quando a regra de exibição manda oferecer o botão.
    const view = examResultView(exam.result);
    if (downloading || view.kind !== "available" || !view.downloadable) return;
    setDownloading(exam.id); setDownloadError(null);
    try {
      const blob = await citizenApi.examPdf(exam.id, citizenId);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = examFilename(exam.id);
      a.click();
      const pending = pendingUrls.current;
      pending.set(url, setTimeout(() => { pending.delete(url); URL.revokeObjectURL(url); }, PDF_URL_TTL_MS));
    } catch (e) {
      if (mounted.current) setDownloadError({ examId: exam.id, message: pdfMessage(e) });
    } finally {
      if (mounted.current) setDownloading(null);
    }
  }

  return (
    <Screen title="Meus exames" footer={<BigButton variant="secondary" onClick={onBack}>Voltar</BigButton>}>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error && <p role="status">Carregando…</p>}
      {data && !data.verified && (
        <div style={{ display: "grid", gap: 12 }}>
          <p role="note" aria-label="cadastro não validado" style={warnNote}>{EXAMS_NOT_VERIFIED}</p>
          <BigButton onClick={() => onValidate(citizenId)}>Validar no posto</BigButton>
        </div>
      )}
      {data && data.verified && (
        <section aria-label="Exames" style={{ display: "grid", gap: 12 }}>
          {data.exams.length === 0 && <p>{EXAMS_EMPTY}</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {data.exams.map((x) => (
              <ExamCard key={x.id} exam={x} downloading={downloading}
                error={downloadError?.examId === x.id ? downloadError.message : null}
                onDownload={() => void download(x)} />
            ))}
          </ul>
          {data.next_before && (
            <div style={{ display: "grid", gap: 8 }}>
              {moreError && <ErrorText>{moreError}</ErrorText>}
              <BigButton variant="secondary" disabled={more} onClick={() => void loadMore()}>Carregar mais</BigButton>
            </div>
          )}
        </section>
      )}
    </Screen>
  );
}

function ExamCard({ exam, downloading, error, onDownload }:
  { exam: CitizenExam; downloading: string | null; error: string | null; onDownload: () => void }) {
  const requested = examRequestedText(exam);
  const schedule = examScheduleText(exam);
  const result = examResultView(exam.result);
  const busy = downloading === exam.id;
  return (
    <li aria-label={exam.label} style={card}>
      <strong>{exam.label}</strong>
      {exam.status_label && <div>{exam.status_label}</div>}
      {requested && <div style={muted}>{requested}</div>}
      {schedule && <div>{schedule}</div>}
      {result.kind === "pickup" && <p style={infoNote}>{result.text}</p>}
      {result.kind === "available" && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <div>{result.text}</div>
          {result.downloadable && (
            <BigButton variant="secondary" disabled={downloading !== null} aria-busy={busy}
              aria-label={busy ? `Baixando resultado de ${exam.label}` : `Baixar resultado de ${exam.label}`}
              onClick={onDownload}>
              {busy ? "Baixando…" : "Baixar resultado (PDF)"}
            </BigButton>
          )}
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </li>
  );
}

const warnNote: CSSProperties = { background: "var(--warn-bg)", padding: 12, borderRadius: 12, margin: 0 };
const infoNote: CSSProperties = { background: "var(--accent-bg)", padding: 12, borderRadius: 12, margin: "8px 0 0" };
const card: CSSProperties = { border: "1px solid var(--rule2)", borderRadius: 12, padding: 12, display: "grid", gap: 4 };
const muted: CSSProperties = { color: "var(--ink2)" };

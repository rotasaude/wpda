// Máquina de telas do canal web do cidadão (spec §4). Sem biblioteca de rotas:
// o estado mora aqui, e um F5 volta ao começo com a sessão (cookie) preservada.
import { useCallback, useEffect, useState } from "react";
import { citizenApi, ApiError, type Step } from "../../lib/citizenApi";
import { PhoneStep } from "./PhoneStep";
import { CodeStep } from "./CodeStep";
import { ConsentStep } from "./ConsentStep";
import { PeopleStep, type PersonChoice } from "./PeopleStep";
import { QuestionStep } from "./QuestionStep";
import { ResultStep } from "./ResultStep";
import { HistoryStep } from "./HistoryStep";
import { VerificationCodeStep } from "./VerificationCodeStep";
import { CounterCodeStep } from "./CounterCodeStep";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

type State =
  | { at: "boot" }
  | { at: "phone" }
  | { at: "code"; phone: string }
  | { at: "consent" }
  | { at: "people"; consentVersion: string }
  | { at: "question"; consentVersion: string; conversationId: string; citizenId: string; step: Step }
  | { at: "result"; consentVersion: string; triageId: string; citizenId: string }
  | { at: "history"; consentVersion: string | null; citizenId: string }
  | { at: "verify-code"; citizenId: string; consentVersion: string | null }
  | { at: "check-in-code"; triageId: string; citizenId: string; consentVersion: string | null }
  | { at: "appointment-check-in-code"; appointmentId: string; citizenId: string; consentVersion: string | null }
  | { at: "declined" };

export function Flow() {
  const [state, setState] = useState<State>({ at: "boot" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi.currentSession()
      .then(() => setState({ at: "consent" }))
      .catch(() => setState({ at: "phone" }));
  }, []);

  useEffect(() => {
    function onUnauthenticated() {
      setState({ at: "phone" });
    }
    window.addEventListener("citizen:unauthenticated", onUnauthenticated);
    return () => window.removeEventListener("citizen:unauthenticated", onUnauthenticated);
  }, []);

  async function choose(consentVersion: string, choice: PersonChoice) {
    setError(null);
    try {
      const r = await citizenApi.start({ ...choice, consentVersion });
      setState({ at: "question", consentVersion, conversationId: r.conversation_id, citizenId: r.citizen_id, step: r.step });
    } catch (e) {
      if (e instanceof ApiError && (e.code === "consent_outdated" || e.code === "no_consent")) {
        setState({ at: "consent" });
        return;
      }
      setError(messageFor(e));
    }
  }

  // Conflitos que retentar não resolve (§ spec de erros): o termo mudou no
  // meio da triagem, o consentimento foi revogado em outra aba, ou a
  // conversa parou de existir (aba aberta >24h). Manda o cidadão para a
  // tela que resolve cada caso, em vez do erro genérico.
  function onConflict(code: string, consentVersion: string) {
    if (code === "not_in_progress") {
      setState({ at: "people", consentVersion });
    } else {
      setState({ at: "consent" });
    }
  }

  async function signOut() {
    try { await citizenApi.signOut(); } finally { setState({ at: "phone" }); }
  }

  // Mesmo cuidado que VerificationCodeStep: sem memoizar por triageId, cada
  // re-render de Flow (ex.: o próprio contador do CounterCodeStep) passaria
  // um `issue` novo e reemitiria o código.
  const checkInTriageId = state.at === "check-in-code" ? state.triageId : null;
  const issueCheckIn = useCallback(
    () => citizenApi.issueCheckInCode(checkInTriageId as string),
    [checkInTriageId]
  );

  // Mesmo cuidado, para o check-in de um horário agendado.
  const checkInAppointmentId = state.at === "appointment-check-in-code" ? state.appointmentId : null;
  const issueAppointmentCheckIn = useCallback(
    () => citizenApi.issueAppointmentCheckInCode(checkInAppointmentId as string),
    [checkInAppointmentId]
  );

  const exit = state.at !== "boot" && state.at !== "phone" && state.at !== "code" && (
    <button type="button" onClick={signOut}
      style={{ position: "fixed", top: 8, right: 8, minHeight: 48, background: "none", border: "none", fontSize: 18 }}>
      Sair
    </button>
  );

  let view;
  switch (state.at) {
    case "boot": view = <Screen title="Triagem de saúde"><p>Carregando…</p></Screen>; break;
    case "phone": view = <PhoneStep onSent={phone => setState({ at: "code", phone })} />; break;
    case "code":
      view = <CodeStep phone={state.phone} onVerified={() => setState({ at: "consent" })}
        onChangePhone={() => setState({ at: "phone" })} />;
      break;
    case "consent":
      view = <ConsentStep onAccept={v => setState({ at: "people", consentVersion: v })}
        onDecline={() => setState({ at: "declined" })} />;
      break;
    case "people":
      view = <>
        {error && <ErrorText>{error}</ErrorText>}
        <PeopleStep onChoose={c => choose(state.consentVersion, c)}
          onHistory={id => setState({ at: "history", consentVersion: state.consentVersion, citizenId: id })} />
      </>;
      break;
    case "question":
      view = <QuestionStep conversationId={state.conversationId} step={state.step}
        onStep={step => setState({ ...state, step })}
        onCompleted={triageId => setState({ at: "result", consentVersion: state.consentVersion, triageId, citizenId: state.citizenId })}
        onConflict={code => onConflict(code, state.consentVersion)} />;
      break;
    case "result":
      view = <ResultStep triageId={state.triageId}
        onAgain={() => setState({ at: "people", consentVersion: state.consentVersion })}
        onHistory={() => setState({ at: "history", consentVersion: state.consentVersion, citizenId: state.citizenId })} />;
      break;
    case "history":
      view = <HistoryStep citizenId={state.citizenId}
        onBack={() => setState(state.consentVersion ? { at: "people", consentVersion: state.consentVersion } : { at: "consent" })}
        onValidate={id => setState({ at: "verify-code", citizenId: id, consentVersion: state.consentVersion })}
        onCheckIn={triageId => setState({ at: "check-in-code", triageId, citizenId: state.citizenId, consentVersion: state.consentVersion })}
        onAppointmentCheckIn={appointmentId => setState({ at: "appointment-check-in-code", appointmentId, citizenId: state.citizenId, consentVersion: state.consentVersion })} />;
      break;
    case "verify-code":
      view = <VerificationCodeStep citizenId={state.citizenId}
        onBack={() => setState({ at: "history", citizenId: state.citizenId, consentVersion: state.consentVersion })} />;
      break;
    case "check-in-code":
      view = <CounterCodeStep title="Cheguei na unidade"
        instruction="Mostre este código e um documento com foto na recepção da unidade."
        issue={issueCheckIn}
        onBack={() => setState({ at: "history", citizenId: state.citizenId, consentVersion: state.consentVersion })} />;
      break;
    case "appointment-check-in-code":
      view = <CounterCodeStep title="Cheguei na unidade"
        instruction="Mostre este código e um documento com foto na recepção da unidade."
        issue={issueAppointmentCheckIn}
        onBack={() => setState({ at: "history", citizenId: state.citizenId, consentVersion: state.consentVersion })} />;
      break;
    case "declined":
      view = <Screen title="Tudo bem" footer={<BigButton onClick={() => setState({ at: "consent" })}>Ler o termo de novo</BigButton>}>
        <p>Sem o seu consentimento não fazemos a triagem, e nenhum CPF ou resposta sua foi guardado.</p>
      </Screen>;
      break;
  }

  return <>{exit}{view}</>;
}

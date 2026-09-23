// Máquina de telas do canal web do cidadão (spec §4). Sem biblioteca de rotas:
// o estado mora aqui, e um F5 volta ao começo com a sessão (cookie) preservada.
import { useEffect, useState } from "react";
import { citizenApi, type Step } from "../../lib/citizenApi";
import { PhoneStep } from "./PhoneStep";
import { CodeStep } from "./CodeStep";
import { ConsentStep } from "./ConsentStep";
import { PeopleStep, type PersonChoice } from "./PeopleStep";
import { QuestionStep } from "./QuestionStep";
import { ResultStep } from "./ResultStep";
import { HistoryStep } from "./HistoryStep";
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
      setError(messageFor(e));
    }
  }

  async function signOut() {
    try { await citizenApi.signOut(); } finally { setState({ at: "phone" }); }
  }

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
        onCompleted={triageId => setState({ at: "result", consentVersion: state.consentVersion, triageId, citizenId: state.citizenId })} />;
      break;
    case "result":
      view = <ResultStep triageId={state.triageId}
        onAgain={() => setState({ at: "people", consentVersion: state.consentVersion })}
        onHistory={() => setState({ at: "history", consentVersion: state.consentVersion, citizenId: state.citizenId })} />;
      break;
    case "history":
      view = <HistoryStep citizenId={state.citizenId}
        onBack={() => setState(state.consentVersion ? { at: "people", consentVersion: state.consentVersion } : { at: "consent" })} />;
      break;
    case "declined":
      view = <Screen title="Tudo bem" footer={<BigButton onClick={() => setState({ at: "consent" })}>Ler o termo de novo</BigButton>}>
        <p>Sem o seu consentimento não fazemos a triagem, e nenhum CPF ou resposta sua foi guardado.</p>
      </Screen>;
      break;
  }

  return <>{exit}{view}</>;
}

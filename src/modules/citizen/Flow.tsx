// Máquina de telas do canal web do cidadão (spec §4). Sem biblioteca de rotas:
// o estado mora aqui. Só a caixa de avisos e as preferências têm endereço
// (<base>avisos, <base>preferencias; spec 2026-09-29 §8): o link do SMS passa
// pelo login e volta para lá. Nas outras telas, um F5 volta ao começo.
import { useCallback, useEffect, useRef, useState } from "react";
import { citizenApi, ApiError, type Step } from "../../lib/citizenApi";
import { pathFor, routeFromPath, type AppRoute } from "../../lib/route";
import { PhoneStep } from "./PhoneStep";
import { CodeStep } from "./CodeStep";
import { ConsentStep } from "./ConsentStep";
import { PeopleStep, type ChooseOutcome, type PersonChoice } from "./PeopleStep";
import { CatalogStep } from "./CatalogStep";
import { ProfileStep } from "./ProfileStep";
import { QuestionStep } from "./QuestionStep";
import { ResultStep } from "./ResultStep";
import { HistoryStep } from "./HistoryStep";
import { VerificationCodeStep } from "./VerificationCodeStep";
import { CounterCodeStep } from "./CounterCodeStep";
import { NoticesLink } from "./NoticesLink";
import { NoticesStep } from "./NoticesStep";
import { PreferencesStep } from "./PreferencesStep";
import { BigButton, ErrorText, Screen, messageFor } from "./ui";

type State =
  | { at: "boot" }
  | { at: "phone" }
  | { at: "code"; phone: string }
  | { at: "consent" }
  | { at: "people"; consentVersion: string }
  | { at: "catalog"; consentVersion: string; citizenId: string; notice: string | null }
  | { at: "profile"; consentVersion: string; citizenId: string; required: boolean }
  | { at: "question"; consentVersion: string; conversationId: string; citizenId: string; step: Step }
  | { at: "result"; consentVersion: string; triageId: string; citizenId: string }
  | { at: "history"; consentVersion: string | null; citizenId: string }
  | { at: "verify-code"; citizenId: string; consentVersion: string | null }
  | { at: "check-in-code"; triageId: string; citizenId: string; consentVersion: string | null }
  | { at: "appointment-check-in-code"; appointmentId: string; citizenId: string; consentVersion: string | null }
  | { at: "notices"; consentVersion: string | null }
  | { at: "preferences"; consentVersion: string | null }
  | { at: "declined" };

export function Flow() {
  const [state, setState] = useState<State>({ at: "boot" });
  const [error, setError] = useState<string | null>(null);
  // Muda a key do link do topo: o selo é relido depois de ler ou silenciar.
  const [badgeTick, setBadgeTick] = useState(0);
  const refreshBadge = () => setBadgeTick(t => t + 1);
  // Muda a key da caixa: "Avisos" no topo sempre volta à lista, mesmo com um aviso aberto.
  const [navTick, setNavTick] = useState(0);
  // Destino pedido pela URL no carregamento (link do SMS). Vale uma vez; a
  // sessão que cai numa dessas telas o guarda de novo; "Sair" o esquece.
  const target = useRef<AppRoute | null>(routeFromPath(window.location.pathname, import.meta.env.BASE_URL));
  const stateRef = useRef(state);
  stateRef.current = state;

  // Depois da sessão confirmada: o destino pedido, ou o termo, como sempre.
  // A caixa de avisos não depende do termo (ADR 0024).
  function enter() {
    const route = target.current;
    target.current = null;
    if (route === "avisos") setState({ at: "notices", consentVersion: null });
    else if (route === "preferencias") setState({ at: "preferences", consentVersion: null });
    else setState({ at: "consent" });
  }

  useEffect(() => {
    // StrictMode monta duas vezes em dev: a resposta da montagem desfeita não
    // pode gastar o destino nem sobrescrever a tela.
    let alive = true;
    citizenApi.currentSession()
      .then(() => { if (alive) enter(); })
      .catch(() => { if (alive) setState({ at: "phone" }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    function onUnauthenticated() {
      const s = stateRef.current;
      if (s.at === "notices") target.current = "avisos";
      else if (s.at === "preferences") target.current = "preferencias";
      setState({ at: "phone" });
    }
    window.addEventListener("citizen:unauthenticated", onUnauthenticated);
    return () => window.removeEventListener("citizen:unauthenticated", onUnauthenticated);
  }, []);

  // URL em dia fora do login (no login, a URL pedida fica para o F5).
  useEffect(() => {
    if (state.at === "boot" || state.at === "phone" || state.at === "code") return;
    const route: AppRoute | null = state.at === "notices" ? "avisos" : state.at === "preferences" ? "preferencias" : null;
    const path = pathFor(route, import.meta.env.BASE_URL);
    if (window.location.pathname !== path) window.history.replaceState(null, "", path);
  }, [state.at]);

  // "Para quem é?" (spec 2026-10-05 §8): pessoa nova nasce com o perfil
  // (POST /citizen/people); quem já existe grava o bairro escolhido, se houver.
  // Os dois seguem para o catálogo, que pede o perfil se faltar (409).
  async function choose(consentVersion: string, choice: PersonChoice): Promise<ChooseOutcome> {
    setError(null);
    try {
      let citizenId: string;
      if ("cpf" in choice) {
        const person = await citizenApi.createPerson({
          cpf: choice.cpf, consentVersion, profile: choice.profile,
          ...(choice.neighborhoodId ? { neighborhoodId: choice.neighborhoodId } : {})
        });
        // 200 = o par já existia (contrato §3.2): sem perfil, grava o informado agora.
        if (!person.profile) await citizenApi.setProfile(person.id, choice.profile);
        // R1 (contrato §7): com o par existente, o POST ignora perfil e bairro; o bairro
        // escolhido vai pela rota própria, e nunca sobrescreve um bairro já gravado.
        if (choice.neighborhoodId && !person.neighborhood) {
          await citizenApi.setNeighborhood(person.id, choice.neighborhoodId);
        }
        citizenId = person.id;
      } else {
        if (choice.neighborhoodId) await citizenApi.setNeighborhood(choice.citizenId, choice.neighborhoodId);
        citizenId = choice.citizenId;
      }
      setState({ at: "catalog", consentVersion, citizenId, notice: null });
    } catch (e) {
      if (e instanceof ApiError && (e.code === "consent_outdated" || e.code === "no_consent")) {
        setState({ at: "consent" });
        return "done";
      }
      // O bairro saiu da lista entre a leitura e o envio: a PeopleStep relê e
      // pergunta de novo (spec 2026-09-28 §6), sem o erro genérico.
      if (e instanceof ApiError && e.code === "invalid_neighborhood") return "invalid_neighborhood";
      setError(messageFor(e));
    }
    return "done";
  }

  // Começa (ou retoma) a triagem escolhida no catálogo ou sugerida no
  // resultado. null = trocou de tela; texto = recusa para a tela mostrar.
  async function startTriage(consentVersion: string, citizenId: string, protocolName: string): Promise<string | null> {
    try {
      const r = await citizenApi.startTriage({ citizenId, protocolName, consentVersion });
      setState({ at: "question", consentVersion, conversationId: r.conversation_id, citizenId: r.citizen_id, step: r.step });
      return null;
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "consent_outdated" || e.code === "no_consent") {
          setState({ at: "consent" });
          return null;
        }
        if (e.code === "profile_required") {
          setState({ at: "profile", consentVersion, citizenId, required: true });
          return null;
        }
      }
      // not_offered, triage_in_progress e o resto: a tela mostra e relê o catálogo.
      return messageFor(e);
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
    target.current = null;
    window.history.replaceState(null, "", pathFor(null, import.meta.env.BASE_URL));
    // Um 401 no logout (sessão já vencida) dispara citizen:unauthenticated, que
    // guardaria o destino de novo: limpa depois do pedido também. O erro é
    // engolido: saiu de qualquer jeito, e o onClick não tem quem o trate.
    try { await citizenApi.signOut(); } catch { /* sessão já encerrada */ } finally {
      target.current = null;
      setState({ at: "phone" });
    }
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

  // Topo de toda tela logada (decisão do usuário, 2026-09-29): "Avisos" com o
  // selo e "Sair". A key relê o selo a cada troca de tela e a cada refreshBadge.
  const signedIn = state.at !== "boot" && state.at !== "phone" && state.at !== "code";
  const consentVersion = "consentVersion" in state ? state.consentVersion : null;
  const top = signedIn && (
    <nav aria-label="Conta"
      style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8,
        maxWidth: 520, margin: "0 auto", padding: "8px 16px 0" }}>
      <NoticesLink key={`${state.at}-${badgeTick}`}
        onOpen={() => { setNavTick(t => t + 1); setState({ at: "notices", consentVersion }); }} />
      <button type="button" onClick={signOut}
        style={{ minHeight: 48, padding: "0 12px", background: "none", border: "none", fontSize: 18 }}>
        Sair
      </button>
    </nav>
  );

  let view;
  switch (state.at) {
    case "boot": view = <Screen title="Triagem de saúde"><p>Carregando…</p></Screen>; break;
    case "phone": view = <PhoneStep onSent={phone => setState({ at: "code", phone })} />; break;
    case "code":
      view = <CodeStep phone={state.phone} onVerified={enter}
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
    case "catalog":
      view = <CatalogStep key={state.citizenId} citizenId={state.citizenId} notice={state.notice}
        onStart={name => startTriage(state.consentVersion, state.citizenId, name)}
        onProfileRequired={() => setState({ at: "profile", consentVersion: state.consentVersion, citizenId: state.citizenId, required: true })}
        onProfile={() => setState({ at: "profile", consentVersion: state.consentVersion, citizenId: state.citizenId, required: false })}
        onHistory={() => setState({ at: "history", consentVersion: state.consentVersion, citizenId: state.citizenId })}
        onBack={() => setState({ at: "people", consentVersion: state.consentVersion })} />;
      break;
    case "profile":
      view = <ProfileStep key={`${state.citizenId}-${state.required}`} citizenId={state.citizenId} required={state.required}
        onSaved={() => setState({ at: "catalog", consentVersion: state.consentVersion, citizenId: state.citizenId,
          notice: state.required ? null : "Perfil atualizado." })}
        onBack={() => setState(state.required
          ? { at: "people", consentVersion: state.consentVersion }
          : { at: "catalog", consentVersion: state.consentVersion, citizenId: state.citizenId, notice: null })} />;
      break;
    case "question":
      view = <QuestionStep conversationId={state.conversationId} step={state.step}
        onStep={step => setState({ ...state, step })}
        onCompleted={triageId => setState({ at: "result", consentVersion: state.consentVersion, triageId, citizenId: state.citizenId })}
        onConflict={code => onConflict(code, state.consentVersion)} />;
      break;
    case "result":
      view = <ResultStep triageId={state.triageId}
        onAgain={() => setState({ at: "catalog", consentVersion: state.consentVersion, citizenId: state.citizenId, notice: null })}
        onHistory={() => setState({ at: "history", consentVersion: state.consentVersion, citizenId: state.citizenId })}
        onStartSuggestion={name => startTriage(state.consentVersion, state.citizenId, name)} />;
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
    case "notices":
      // A caixa não depende do termo (ADR 0024): sem versão guardada, voltar
      // leva ao termo, que segue obrigatório para começar a triagem.
      view = <NoticesStep key={navTick} onRead={refreshBadge}
        onPreferences={() => setState({ at: "preferences", consentVersion: state.consentVersion })}
        onBack={() => setState(state.consentVersion ? { at: "people", consentVersion: state.consentVersion } : { at: "consent" })} />;
      break;
    case "preferences":
      view = <PreferencesStep onSaved={refreshBadge}
        onBack={() => setState({ at: "notices", consentVersion: state.consentVersion })} />;
      break;
    case "declined":
      view = <Screen title="Tudo bem" footer={<BigButton onClick={() => setState({ at: "consent" })}>Ler o termo de novo</BigButton>}>
        <p>Sem o seu consentimento não fazemos a triagem, e nenhum CPF ou resposta sua foi guardado.</p>
      </Screen>;
      break;
  }

  return <>{top}{view}</>;
}

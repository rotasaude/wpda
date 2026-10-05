import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flow } from "./Flow";
import { citizenApi, ApiError, type Catalog, type Person, type Step } from "../../lib/citizenApi";

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-10-05T10:00:00-03:00"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

const PROFILE_IN = { birth_date: "1963-04-02", sex: "female" as const, gender_identity: null };
const avo: Person = {
  id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null,
  profile: { ...PROFILE_IN, profile_source: "declared" }
};
const semPerfil: Person = { ...avo, profile: null };

const CATALOG: Catalog = {
  in_progress: null, suggested: [],
  available: [ { protocol_name: "saude-do-idoso", title: "Saúde do idoso", summary: "Avaliação anual de quedas, memória e medicamentos." } ],
  recent: [], reference_units: []
};

const step: Step = {
  triage_id: "t1", step_id: "quedas", prompt: "Você caiu nos últimos 12 meses?", answer_type: "boolean",
  options: [ { id: "true", title: "Sim" }, { id: "false", title: "Não" } ], index: 1, total: 3, can_undo: false
};

function signedIn(people: Person[]) {
  vi.spyOn(citizenApi, "currentSession").mockResolvedValue({ phone_masked: "(**) *****-5432" });
  vi.spyOn(citizenApi, "consentTerm").mockResolvedValue({ version: "1", body: "Termo" });
  vi.spyOn(citizenApi, "people").mockResolvedValue({ people });
  vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([]);
  vi.spyOn(citizenApi, "appointments").mockResolvedValue({ appointments: [] });
  vi.spyOn(citizenApi, "notices").mockResolvedValue({ notices: [], unread_count: 0 });
}

async function choosePerson() {
  render(<Flow />);
  await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
  await userEvent.click(await screen.findByRole("button", { name: "CPF ***.982.247-**" }));
}

async function typeNewCpfAndProfile() {
  render(<Flow />);
  await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
  await userEvent.type(await screen.findByLabelText("CPF de outra pessoa"), "52998224725");
  await userEvent.click(screen.getByRole("button", { name: "Continuar com este CPF" }));
  await fillProfile();
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

async function fillProfile() {
  await userEvent.type(await screen.findByLabelText("Data de nascimento"), "02041963");
  await userEvent.click(screen.getByRole("radio", { name: "Feminino" }));
}

const findItem = async (title: string) => (await screen.findByText(title)).closest("li") as HTMLElement;

describe("Flow — catálogo e início por protocolo", () => {
  it("pessoa com perfil: catálogo e início pela triagem escolhida", async () => {
    signedIn([ avo ]);
    const catalog = vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    const start = vi.spyOn(citizenApi, "startTriage")
      .mockResolvedValue({ conversation_id: "c1", citizen_id: "p1", resumed: false, step });
    await choosePerson();

    await userEvent.click(within(await findItem("Saúde do idoso")).getByRole("button", { name: "Começar" }));

    expect(await screen.findByText("Você caiu nos últimos 12 meses?")).toBeInTheDocument();
    expect(catalog).toHaveBeenCalledWith("p1");
    expect(start).toHaveBeenCalledWith({ citizenId: "p1", protocolName: "saude-do-idoso", consentVersion: "1" });
  });

  it("pessoa sem perfil: o catálogo pede o perfil (409) e, salvo, o catálogo aparece", async () => {
    signedIn([ semPerfil ]);
    const catalog = vi.spyOn(citizenApi, "catalog")
      .mockRejectedValueOnce(new ApiError(409, "profile_required")).mockResolvedValue(CATALOG);
    const set = vi.spyOn(citizenApi, "setProfile").mockResolvedValue(avo);
    await choosePerson();

    expect(await screen.findByRole("heading", { name: "Sobre esta pessoa" })).toBeInTheDocument();
    await fillProfile();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("region", { name: "Disponíveis" })).toBeInTheDocument();
    expect(set).toHaveBeenCalledWith("p1", PROFILE_IN);
    expect(catalog).toHaveBeenCalledTimes(2);
  });

  it("perfil obrigatório: 'Voltar' volta à escolha de pessoa", async () => {
    signedIn([ semPerfil ]);
    vi.spyOn(citizenApi, "catalog").mockRejectedValue(new ApiError(409, "profile_required"));
    await choosePerson();
    await screen.findByRole("heading", { name: "Sobre esta pessoa" });
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
  });

  it("CPF novo: o par nasce com o perfil (POST /citizen/people) e o catálogo é o dele", async () => {
    signedIn([]);
    const create = vi.spyOn(citizenApi, "createPerson").mockResolvedValue({ ...avo, id: "p9" });
    const set = vi.spyOn(citizenApi, "setProfile");
    const catalog = vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    await typeNewCpfAndProfile();

    expect(await screen.findByRole("region", { name: "Disponíveis" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({ cpf: "529.982.247-25", consentVersion: "1", profile: PROFILE_IN });
    expect("neighborhoodId" in (create.mock.calls[0][0] as object)).toBe(false);
    expect(set).not.toHaveBeenCalled();
    expect(catalog).toHaveBeenCalledWith("p9");
  });

  it("CPF que já existia sem perfil (200): grava o perfil informado e segue", async () => {
    signedIn([]);
    vi.spyOn(citizenApi, "createPerson").mockResolvedValue({ ...semPerfil, id: "p9" });
    const set = vi.spyOn(citizenApi, "setProfile").mockResolvedValue({ ...avo, id: "p9" });
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    await typeNewCpfAndProfile();

    expect(await screen.findByRole("region", { name: "Disponíveis" })).toBeInTheDocument();
    expect(set).toHaveBeenCalledWith("p9", PROFILE_IN);
  });

  it("CPF que já existia com perfil (200): não sobrescreve e segue", async () => {
    signedIn([]);
    vi.spyOn(citizenApi, "createPerson").mockResolvedValue({ ...avo, id: "p9" });
    const set = vi.spyOn(citizenApi, "setProfile");
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    await typeNewCpfAndProfile();

    expect(await screen.findByRole("region", { name: "Disponíveis" })).toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
  });

  it("CPF novo com termo vencido (409 consent_outdated): volta ao termo", async () => {
    signedIn([]);
    vi.spyOn(citizenApi, "createPerson").mockRejectedValue(new ApiError(409, "consent_outdated"));
    await typeNewCpfAndProfile();
    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });

  it("'Meu perfil' no catálogo: corrige e volta ao catálogo com aviso", async () => {
    signedIn([ avo ]);
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    const set = vi.spyOn(citizenApi, "setProfile").mockResolvedValue(avo);
    await choosePerson();

    await userEvent.click(await screen.findByRole("button", { name: "Meu perfil" }));
    const birth = await screen.findByLabelText("Data de nascimento");
    await userEvent.clear(birth);
    await userEvent.type(birth, "03041963");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Perfil atualizado.");
    expect(set).toHaveBeenCalledWith("p1", { ...PROFILE_IN, birth_date: "1963-04-03" });
  });

  it("'Em andamento': 'Continuar' retoma pela triagem aberta", async () => {
    signedIn([ avo ]);
    vi.spyOn(citizenApi, "catalog").mockResolvedValue({ ...CATALOG,
      in_progress: { conversation_id: "c1", protocol_name: "triage-respiratoria", title: "Sintomas respiratórios" } });
    const start = vi.spyOn(citizenApi, "startTriage")
      .mockResolvedValue({ conversation_id: "c1", citizen_id: "p1", resumed: true, step });
    await choosePerson();

    await userEvent.click(within(await screen.findByRole("region", { name: "Em andamento" }))
      .getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Você caiu nos últimos 12 meses?")).toBeInTheDocument();
    expect(start).toHaveBeenCalledWith({ citizenId: "p1", protocolName: "triage-respiratoria", consentVersion: "1" });
  });

  it("'Voltar' no catálogo volta à escolha de pessoa", async () => {
    signedIn([ avo ]);
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    await choosePerson();
    await screen.findByRole("region", { name: "Disponíveis" });
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
  });
});

describe("Flow — bairro de CPF que já existia (R1, contrato §7)", () => {
  it("CPF que já existia sem bairro (200): grava o bairro escolhido e segue", async () => {
    signedIn([]);
    vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([ { id: "n1", name: "Batel" } ]);
    const create = vi.spyOn(citizenApi, "createPerson").mockResolvedValue({ ...avo, id: "p9", neighborhood: null });
    const setN = vi.spyOn(citizenApi, "setNeighborhood").mockResolvedValue({});
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    await typeNewCpfAndProfile();
    await userEvent.click(await screen.findByRole("button", { name: "Batel" }));

    expect(await screen.findByRole("region", { name: "Disponíveis" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ neighborhoodId: "n1" }));
    expect(setN).toHaveBeenCalledWith("p9", "n1");
  });

  it("CPF que já existia com bairro (200): não sobrescreve o bairro", async () => {
    signedIn([]);
    vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue([ { id: "n1", name: "Batel" } ]);
    vi.spyOn(citizenApi, "createPerson")
      .mockResolvedValue({ ...avo, id: "p9", neighborhood: { id: "n2", name: "Centro" } });
    const setN = vi.spyOn(citizenApi, "setNeighborhood").mockResolvedValue({});
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    await typeNewCpfAndProfile();
    await userEvent.click(await screen.findByRole("button", { name: "Batel" }));

    expect(await screen.findByRole("region", { name: "Disponíveis" })).toBeInTheDocument();
    expect(setN).not.toHaveBeenCalled();
  });
});

describe("Flow — recusas ao começar", () => {
  it.each([
    [ "not_offered", "Esta triagem não está mais disponível para esta pessoa." ],
    [ "triage_in_progress", "Já existe uma triagem em andamento para esta pessoa. Continue a que está aberta." ]
  ])("409 %s: fica no catálogo relido, com o aviso", async (code, message) => {
    signedIn([ avo ]);
    const catalog = vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    vi.spyOn(citizenApi, "startTriage").mockRejectedValue(new ApiError(409, code));
    await choosePerson();

    await userEvent.click(within(await findItem("Saúde do idoso")).getByRole("button", { name: "Começar" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(catalog).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Algo deu errado. Tente de novo.")).not.toBeInTheDocument();
  });

  it("409 profile_required ao começar: vai para o perfil obrigatório", async () => {
    signedIn([ avo ]);
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    vi.spyOn(citizenApi, "startTriage").mockRejectedValue(new ApiError(409, "profile_required"));
    await choosePerson();

    await userEvent.click(within(await findItem("Saúde do idoso")).getByRole("button", { name: "Começar" }));

    expect(await screen.findByRole("heading", { name: "Sobre esta pessoa" })).toBeInTheDocument();
  });

  it.each([ "consent_outdated", "no_consent" ])("409 %s ao começar: volta ao termo", async (code) => {
    signedIn([ avo ]);
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    vi.spyOn(citizenApi, "startTriage").mockRejectedValue(new ApiError(409, code));
    await choosePerson();

    await userEvent.click(within(await findItem("Saúde do idoso")).getByRole("button", { name: "Começar" }));

    expect(await screen.findByRole("button", { name: "Concordo" })).toBeInTheDocument();
  });
});

describe("Flow — privacidade do perfil (ADR 0027, invariantes)", () => {
  it("nenhum dado de perfil vai para a URL ou para o console, nem no erro do api", async () => {
    const methods = [ "log", "info", "warn", "error", "debug" ] as const;
    const spies = methods.map(m => vi.spyOn(console, m).mockImplementation(() => {}));
    signedIn([]);
    vi.spyOn(citizenApi, "createPerson")
      .mockRejectedValueOnce(new ApiError(422, "invalid_birth_date"))
      .mockResolvedValue({ ...avo, id: "p9" });
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);

    render(<Flow />);
    await userEvent.click(await screen.findByRole("button", { name: "Concordo" }));
    await userEvent.type(await screen.findByLabelText("CPF de outra pessoa"), "52998224725");
    await userEvent.click(screen.getByRole("button", { name: "Continuar com este CPF" }));
    await fillProfile();
    await userEvent.click(screen.getByRole("radio", { name: "Mulher trans" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Data de nascimento inválida. Confira dia, mês e ano.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("region", { name: "Disponíveis" })).toBeInTheDocument();

    const leaked = /1963|02\/04|female|trans_woman|Feminino|Mulher trans/;
    expect(window.location.href).not.toMatch(leaked);
    for (const spy of spies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(leaked);
  });
});

describe("Flow — resultado com sugestão", () => {
  async function reachResult() {
    signedIn([ avo ]);
    vi.spyOn(citizenApi, "catalog").mockResolvedValue(CATALOG);
    const start = vi.spyOn(citizenApi, "startTriage")
      .mockResolvedValueOnce({ conversation_id: "c1", citizen_id: "p1", resumed: false, step })
      .mockResolvedValue({ conversation_id: "c2", citizen_id: "p1", resumed: false,
        step: { ...step, triage_id: "t2", step_id: "humor", prompt: "Como está o seu humor?" } });
    vi.spyOn(citizenApi, "answer").mockResolvedValue({ status: "completed", triage_id: "t1" });
    vi.spyOn(citizenApi, "triage").mockResolvedValue({
      id: "t1", status: "completed", tier: "media", priority: 2, created_at: "2026-10-05T12:00:00Z",
      completed_at: "2026-10-05T12:05:00Z", report_url: null, consent_active: true, origin_phone_masked: null,
      attendance: null, check_in_available: false, reference_units: [],
      suggestions: [ { suggestion_id: "s1", protocol_name: "saude-mental-aprofundada",
        title: "Saúde mental — aprofundamento", summary: null } ]
    });
    await choosePerson();
    await userEvent.click(within(await findItem("Saúde do idoso")).getByRole("button", { name: "Começar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Não" }));
    await screen.findByRole("heading", { name: "Recomendamos também" });
    return { start };
  }

  it("'Fazer agora' começa a triagem sugerida para a mesma pessoa", async () => {
    const { start } = await reachResult();
    await userEvent.click(screen.getByRole("button", { name: "Fazer agora" }));
    expect(await screen.findByText("Como está o seu humor?")).toBeInTheDocument();
    expect(start).toHaveBeenLastCalledWith({ citizenId: "p1", protocolName: "saude-mental-aprofundada", consentVersion: "1" });
  });

  it("'Fazer outra triagem' abre o catálogo da mesma pessoa", async () => {
    await reachResult();
    await userEvent.click(screen.getByRole("button", { name: "Fazer outra triagem" }));
    expect(await screen.findByRole("heading", { name: "Qual triagem fazer?" })).toBeInTheDocument();
  });
});

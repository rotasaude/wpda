import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HealthConditions } from "./HealthConditions";
import { ProfileStep } from "./ProfileStep";
import { CARE_DISABLED, CONDITIONS_HELP } from "../../lib/care";
import { ApiError, citizenApi, type Person } from "../../lib/citizenApi";
import { setSessionFeatures } from "../../lib/sessionFeatures";

afterEach(() => { vi.restoreAllMocks(); setSessionFeatures(null); });

const DIABETES = { condition: "diabetes", declared_at: "2026-10-20T10:00:00-03:00" };
const PRESSURE = { condition: "hypertension", declared_at: "2026-10-22T09:00:00-03:00" };
const VERIFIED: Person = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "verified", neighborhood: null,
  profile: { birth_date: "1963-04-02", sex: "female", gender_identity: null, profile_source: "verified" } };
// Validado por check-in: par verificado, perfil ainda só declarado (P8).
const CHECKED_IN: Person = { ...VERIFIED,
  profile: { birth_date: "1963-04-02", sex: "female", gender_identity: null, profile_source: "declared" } };
const DECLARED: Person = { ...CHECKED_IN, verification_level: "declared" };

const status = () => screen.getByRole("status");

describe("HealthConditions", () => {
  it("mostra as ativas ligadas, com a explicação de que não é diagnóstico", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([ DIABETES ]);
    render(<HealthConditions citizenId="p1" />);
    expect(await screen.findByRole("switch", { name: "Tenho diabetes" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Tenho pressão alta" })).not.toBeChecked();
    expect(screen.getByText(CONDITIONS_HELP)).toBeInTheDocument();
    expect(citizenApi.declaredConditions).toHaveBeenCalledWith("p1");
  });

  it("'Estou grávida' aparece para todos", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([]);
    render(<HealthConditions citizenId="p1" />);
    expect(await screen.findByRole("switch", { name: "Estou grávida" })).toBeInTheDocument();
  });

  it("ligar declara e reflete a lista do api", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([ DIABETES ]);
    const declare = vi.spyOn(citizenApi, "declareCondition").mockResolvedValue([ DIABETES, PRESSURE ]);
    render(<HealthConditions citizenId="p1" />);
    await userEvent.click(await screen.findByRole("switch", { name: "Tenho pressão alta" }));
    expect(declare).toHaveBeenCalledWith("p1", "hypertension");
    await waitFor(() => expect(status()).toHaveTextContent("Informação salva."));
    expect(screen.getByRole("switch", { name: "Tenho pressão alta" })).toBeChecked();
  });

  it("desligar retira e diz que retirou", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([ DIABETES, PRESSURE ]);
    const withdraw = vi.spyOn(citizenApi, "withdrawCondition").mockResolvedValue([ PRESSURE ]);
    render(<HealthConditions citizenId="p1" />);
    await userEvent.click(await screen.findByRole("switch", { name: "Tenho diabetes" }));
    expect(withdraw).toHaveBeenCalledWith("p1", "diabetes");
    await waitFor(() => expect(status()).toHaveTextContent("Informação retirada."));
    expect(screen.getByRole("switch", { name: "Tenho diabetes" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Tenho pressão alta" })).toBeChecked();
  });

  it("o aviso de status fica sempre montado, vazio até haver o que dizer", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([]);
    render(<HealthConditions citizenId="p1" />);
    await screen.findByRole("switch", { name: "Tenho diabetes" });
    expect(status()).toBeEmptyDOMElement();
  });

  it("em curso, só o interruptor tocado fica desabilitado", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([]);
    let release!: (v: typeof DIABETES[]) => void;
    vi.spyOn(citizenApi, "declareCondition").mockReturnValue(new Promise(r => { release = r; }));
    render(<HealthConditions citizenId="p1" />);
    await userEvent.click(await screen.findByRole("switch", { name: "Tenho diabetes" }));
    expect(screen.getByRole("switch", { name: "Tenho diabetes" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Tenho pressão alta" })).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Estou grávida" })).toBeEnabled();
    release([ DIABETES ]);
    await waitFor(() => expect(screen.getByRole("switch", { name: "Tenho diabetes" })).toBeEnabled());
    expect(screen.getByRole("switch", { name: "Tenho diabetes" })).toBeChecked();
  });

  it("recusa do api: a frase e o interruptor como estava", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([]);
    vi.spyOn(citizenApi, "declareCondition").mockRejectedValue(new ApiError(422, "invalid_condition"));
    render(<HealthConditions citizenId="p1" />);
    await userEvent.click(await screen.findByRole("switch", { name: "Estou grávida" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Essa opção não está mais disponível. Atualize a tela.");
    expect(screen.getByRole("switch", { name: "Estou grávida" })).not.toBeChecked();
  });

  it("retirar uma condição que já não vale (404): relê a lista, sem mensagem, e o interruptor não fica preso", async () => {
    const read = vi.spyOn(citizenApi, "declaredConditions")
      .mockResolvedValueOnce([ DIABETES, PRESSURE ])
      .mockResolvedValueOnce([ PRESSURE ]);
    vi.spyOn(citizenApi, "withdrawCondition").mockRejectedValue(new ApiError(404, "not_found"));
    render(<HealthConditions citizenId="p1" />);
    await userEvent.click(await screen.findByRole("switch", { name: "Tenho diabetes" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Tenho diabetes" })).not.toBeChecked());
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("switch", { name: "Tenho diabetes" })).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Tenho pressão alta" })).toBeChecked();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Não encontramos esta pessoa/)).not.toBeInTheDocument();
  });

  it("par declarado (403 not_verified) ou interruptor desligado: a seção some", async () => {
    vi.spyOn(citizenApi, "declaredConditions").mockRejectedValueOnce(new ApiError(403, "not_verified"));
    const { unmount } = render(<HealthConditions citizenId="p1" />);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Condições de saúde" })).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();
    vi.spyOn(citizenApi, "declaredConditions").mockRejectedValueOnce(new ApiError(403, "feature_disabled"));
    render(<HealthConditions citizenId="p1" />);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Condições de saúde" })).not.toBeInTheDocument());
    expect(screen.queryByText(CARE_DISABLED)).not.toBeInTheDocument();
  });
});

describe("ProfileStep — condições de saúde", () => {
  it("perfil conferido com care_lines: a seção aparece abaixo do texto do posto", async () => {
    setSessionFeatures([ "care_lines" ]);
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ VERIFIED ] });
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([]);
    render(<ProfileStep citizenId="p1" required={false} onSaved={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Condições de saúde" })).toBeInTheDocument();
    expect(await screen.findByRole("switch", { name: "Faço acompanhamento de saúde mental" })).toBeInTheDocument();
  });

  it("par validado por check-in (perfil declarado) com care_lines: a seção aparece abaixo do formulário", async () => {
    setSessionFeatures([ "care_lines" ]);
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ CHECKED_IN ] });
    vi.spyOn(citizenApi, "declaredConditions").mockResolvedValue([ DIABETES ]);
    render(<ProfileStep citizenId="p1" required={false} onSaved={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByLabelText("Data de nascimento")).toBeInTheDocument();
    expect(await screen.findByRole("switch", { name: "Tenho diabetes" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("par só declarado: sem a seção e sem chamar o api de condições", async () => {
    setSessionFeatures([ "care_lines" ]);
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ DECLARED ] });
    const load = vi.spyOn(citizenApi, "declaredConditions");
    render(<ProfileStep citizenId="p1" required={false} onSaved={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByLabelText("Data de nascimento")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Condições de saúde" })).not.toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it("sem care_lines na sessão: o perfil conferido é o de hoje", async () => {
    setSessionFeatures([ "exam_tracking" ]);
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ VERIFIED ] });
    const load = vi.spyOn(citizenApi, "declaredConditions");
    render(<ProfileStep citizenId="p1" required={false} onSaved={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByText("Data de nascimento")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Condições de saúde" })).not.toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });
});

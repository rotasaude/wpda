import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeopleStep, type ChooseOutcome } from "./PeopleStep";
import { citizenApi, type Person } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

const LIST = [
  { id: "n1", name: "Batel" },
  { id: "n2", name: "São Francisco" },
  { id: "n3", name: "Santa Felicidade" }
];
const semBairro: Person = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null };
const comBairro: Person = { ...semBairro, neighborhood: { id: "n1", name: "Batel" } };

function setup(people: Person[], list: typeof LIST | Error = LIST) {
  vi.spyOn(citizenApi, "people").mockResolvedValue({ people });
  const neighborhoods = list instanceof Error
    ? vi.spyOn(citizenApi, "neighborhoods").mockRejectedValue(list)
    : vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue(list);
  const onChoose = vi.fn<(c: unknown) => Promise<ChooseOutcome>>().mockResolvedValue("done");
  render(<PeopleStep onChoose={onChoose} onHistory={vi.fn()} />);
  return { onChoose, neighborhoods };
}

async function typeNewCpf() {
  await userEvent.type(await screen.findByLabelText("CPF de outra pessoa"), "52998224725");
  await userEvent.click(screen.getByRole("button", { name: "Continuar com este CPF" }));
}

describe("PeopleStep — bairro antes de começar", () => {
  it("CPF novo: pergunta o bairro, busca sem acento e manda o escolhido junto com o CPF", async () => {
    const { onChoose } = setup([]);
    await typeNewCpf();

    expect(await screen.findByRole("heading", { name: "Em que bairro esta pessoa mora?" })).toBeInTheDocument();
    expect(onChoose).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Buscar bairro"), "sao");
    expect(screen.queryByRole("button", { name: "Batel" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "São Francisco" }));

    await waitFor(() => expect(onChoose).toHaveBeenCalledWith({ cpf: "529.982.247-25", neighborhoodId: "n2" }));
  });

  it("CPF novo: 'Prefiro não informar' começa sem bairro", async () => {
    const { onChoose } = setup([]);
    await typeNewCpf();
    await userEvent.click(await screen.findByRole("button", { name: "Prefiro não informar" }));

    await waitFor(() => expect(onChoose).toHaveBeenCalledTimes(1));
    expect(onChoose.mock.calls[0][0]).toEqual({ cpf: "529.982.247-25" });
    expect("neighborhoodId" in (onChoose.mock.calls[0][0] as object)).toBe(false);
  });

  it("busca sem resultado avisa", async () => {
    setup([]);
    await typeNewCpf();
    await userEvent.type(await screen.findByLabelText("Buscar bairro"), "xyz");
    expect(screen.getByText("Nenhum bairro encontrado com esse nome.")).toBeInTheDocument();
  });

  it("'Voltar' na pergunta volta para a lista de pessoas", async () => {
    const { onChoose } = setup([]);
    await typeNewCpf();
    await userEvent.click(await screen.findByRole("button", { name: "Voltar" }));
    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("pessoa existente sem bairro: pergunta uma vez antes de começar", async () => {
    const { onChoose } = setup([ semBairro ]);
    expect(await screen.findByText("Bairro não informado")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "CPF ***.982.247-**" }));
    await userEvent.click(await screen.findByRole("button", { name: "Batel" }));

    await waitFor(() => expect(onChoose).toHaveBeenCalledWith({ citizenId: "p1", neighborhoodId: "n1" }));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it("pessoa existente com bairro: começa direto, sem mandar bairro", async () => {
    const { onChoose } = setup([ comBairro ]);
    expect(await screen.findByText("Bairro: Batel")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "CPF ***.982.247-**" }));

    await waitFor(() => expect(onChoose).toHaveBeenCalledWith({ citizenId: "p1" }));
    expect(screen.queryByRole("heading", { name: "Em que bairro esta pessoa mora?" })).not.toBeInTheDocument();
  });

  it("cidade sem bairros: não pergunta nem oferece troca", async () => {
    const { onChoose } = setup([ semBairro ], []);
    await userEvent.click(await screen.findByRole("button", { name: "CPF ***.982.247-**" }));
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith({ citizenId: "p1" }));
    expect(screen.queryByText("Bairro não informado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Trocar bairro/ })).not.toBeInTheDocument();
  });

  it("lista com erro (api antiga ou rede): segue sem perguntar", async () => {
    const { onChoose } = setup([], new Error("offline"));
    await typeNewCpf();
    await waitFor(() => expect(onChoose).toHaveBeenCalledWith({ cpf: "529.982.247-25" }));
  });

  it("422 invalid_neighborhood: relê a lista, avisa e pede nova escolha", async () => {
    const { onChoose, neighborhoods } = setup([ semBairro ]);
    neighborhoods.mockResolvedValueOnce(LIST).mockResolvedValueOnce(LIST.filter(n => n.id !== "n1"));
    onChoose.mockResolvedValueOnce("invalid_neighborhood").mockResolvedValue("done");

    await userEvent.click(await screen.findByRole("button", { name: "CPF ***.982.247-**" }));
    await userEvent.click(await screen.findByRole("button", { name: "Batel" }));

    expect(await screen.findByText("Esse bairro não está mais na lista. Escolha de novo.")).toBeInTheDocument();
    expect(neighborhoods).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Batel" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "São Francisco" }));
    await waitFor(() => expect(onChoose).toHaveBeenLastCalledWith({ citizenId: "p1", neighborhoodId: "n2" }));
  });

  it("422 com a lista agora vazia: começa sem bairro", async () => {
    const { onChoose, neighborhoods } = setup([ semBairro ]);
    neighborhoods.mockResolvedValueOnce(LIST).mockResolvedValueOnce([]);
    onChoose.mockResolvedValueOnce("invalid_neighborhood").mockResolvedValue("done");

    await userEvent.click(await screen.findByRole("button", { name: "CPF ***.982.247-**" }));
    await userEvent.click(await screen.findByRole("button", { name: "Batel" }));

    await waitFor(() => expect(onChoose).toHaveBeenLastCalledWith({ citizenId: "p1" }));
    expect(onChoose).toHaveBeenCalledTimes(2);
  });

  it("toque duplo no bairro chama uma vez só", async () => {
    const { onChoose } = setup([ semBairro ]);
    onChoose.mockReturnValue(new Promise<ChooseOutcome>(() => {}));
    await userEvent.click(await screen.findByRole("button", { name: "CPF ***.982.247-**" }));
    const batel = await screen.findByRole("button", { name: "Batel" });
    await userEvent.click(batel);
    await userEvent.click(batel);

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(batel).toBeDisabled();
  });
});

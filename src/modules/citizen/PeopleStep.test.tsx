import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeopleStep, type ChooseOutcome } from "./PeopleStep";
import { ApiError, citizenApi, type Person } from "../../lib/citizenApi";

afterEach(() => vi.restoreAllMocks());

const LIST = [
  { id: "n1", name: "Batel" },
  { id: "n2", name: "São Francisco" },
  { id: "n3", name: "Santa Felicidade" }
];
const semBairro: Person = { id: "p1", cpf_masked: "***.982.247-**", verification_level: "declared", neighborhood: null };
const comBairro: Person = { ...semBairro, neighborhood: { id: "n1", name: "Batel" } };

function setup(people: Person[], list: typeof LIST | Error | { once: typeof LIST[] } = LIST) {
  vi.spyOn(citizenApi, "people").mockResolvedValue({ people });
  const neighborhoods = vi.spyOn(citizenApi, "neighborhoods");
  if (list instanceof Error) neighborhoods.mockRejectedValue(list);
  else if (Array.isArray(list)) neighborhoods.mockResolvedValue(list);
  else list.once.forEach(l => neighborhoods.mockResolvedValueOnce(l));
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
    const { onChoose, neighborhoods } = setup([ semBairro ],
      { once: [ LIST, LIST.filter(n => n.id !== "n1") ] });
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
    const { onChoose } = setup([ semBairro ], { once: [ LIST, [] ] });
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

  it("toque duplo na pessoa com a lista ainda pendente começa uma vez só", async () => {
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ comBairro ] });
    let resolve!: (l: typeof LIST) => void;
    vi.spyOn(citizenApi, "neighborhoods").mockReturnValue(new Promise(r => { resolve = r; }));
    const onChoose = vi.fn<(c: unknown) => Promise<ChooseOutcome>>().mockResolvedValue("done");
    render(<PeopleStep onChoose={onChoose} onHistory={vi.fn()} />);
    const btn = await screen.findByRole("button", { name: "CPF ***.982.247-**" });
    await userEvent.click(btn);
    await userEvent.click(btn);
    resolve(LIST);
    await waitFor(() => expect(onChoose).toHaveBeenCalledTimes(1));
    await new Promise(r => setTimeout(r, 50));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});

describe("PeopleStep — Trocar bairro", () => {
  it("troca o bairro, relê as pessoas e confirma", async () => {
    const people = vi.spyOn(citizenApi, "people")
      .mockResolvedValueOnce({ people: [ comBairro ] })
      .mockResolvedValue({ people: [ { ...comBairro, neighborhood: { id: "n2", name: "São Francisco" } } ] });
    vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue(LIST);
    const set = vi.spyOn(citizenApi, "setNeighborhood").mockResolvedValue({});
    const onChoose = vi.fn().mockResolvedValue("done");
    render(<PeopleStep onChoose={onChoose} onHistory={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Trocar bairro de ***.982.247-**" }));
    expect(await screen.findByRole("heading", { name: "Bairro de ***.982.247-**" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "São Francisco" }));

    expect(await screen.findByText("Bairro atualizado.")).toBeInTheDocument();
    expect(await screen.findByText("Bairro: São Francisco")).toBeInTheDocument();
    expect(set).toHaveBeenCalledWith("p1", "n2");
    expect(people).toHaveBeenCalledTimes(2);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("'Prefiro não informar' na troca tira o bairro (manda null)", async () => {
    vi.spyOn(citizenApi, "people")
      .mockResolvedValueOnce({ people: [ comBairro ] })
      .mockResolvedValue({ people: [ semBairro ] });
    vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue(LIST);
    const set = vi.spyOn(citizenApi, "setNeighborhood").mockResolvedValue({});
    render(<PeopleStep onChoose={vi.fn().mockResolvedValue("done")} onHistory={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Trocar bairro de ***.982.247-**" }));
    await userEvent.click(await screen.findByRole("button", { name: "Prefiro não informar" }));

    expect(await screen.findByText("Bairro não informado")).toBeInTheDocument();
    expect(set).toHaveBeenCalledWith("p1", null);
  });

  it("422 invalid_neighborhood na troca: relê a lista e avisa, sem sair da pergunta", async () => {
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ comBairro ] });
    const neighborhoods = vi.spyOn(citizenApi, "neighborhoods")
      .mockResolvedValueOnce(LIST).mockResolvedValue(LIST.filter(n => n.id !== "n2"));
    vi.spyOn(citizenApi, "setNeighborhood").mockRejectedValue(new ApiError(422, "invalid_neighborhood"));
    render(<PeopleStep onChoose={vi.fn().mockResolvedValue("done")} onHistory={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Trocar bairro de ***.982.247-**" }));
    await userEvent.click(await screen.findByRole("button", { name: "São Francisco" }));

    expect(await screen.findByText("Esse bairro não está mais na lista. Escolha de novo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bairro de ***.982.247-**" })).toBeInTheDocument();
    expect(neighborhoods).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("button", { name: "São Francisco" })).not.toBeInTheDocument());
  });

  it("404 (CPF fora da sessão): mostra a mensagem, sem sair da pergunta", async () => {
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ comBairro ] });
    vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue(LIST);
    vi.spyOn(citizenApi, "setNeighborhood").mockRejectedValue(new ApiError(404, "not_found"));
    render(<PeopleStep onChoose={vi.fn().mockResolvedValue("done")} onHistory={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Trocar bairro de ***.982.247-**" }));
    await userEvent.click(await screen.findByRole("button", { name: "Batel" }));

    expect(await screen.findByText("Algo deu errado. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bairro de ***.982.247-**" })).toBeInTheDocument();
  });

  it("'Voltar' na troca não grava nada", async () => {
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ comBairro ] });
    vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue(LIST);
    const set = vi.spyOn(citizenApi, "setNeighborhood");
    render(<PeopleStep onChoose={vi.fn().mockResolvedValue("done")} onHistory={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Trocar bairro de ***.982.247-**" }));
    await userEvent.click(await screen.findByRole("button", { name: "Voltar" }));

    expect(await screen.findByText("Para quem é esta triagem?")).toBeInTheDocument();
    expect(set).not.toHaveBeenCalled();
  });

  it("toque duplo em um bairro grava uma vez só", async () => {
    vi.spyOn(citizenApi, "people").mockResolvedValue({ people: [ comBairro ] });
    vi.spyOn(citizenApi, "neighborhoods").mockResolvedValue(LIST);
    const set = vi.spyOn(citizenApi, "setNeighborhood").mockImplementation(() => new Promise(r => setTimeout(() => r({}), 20)));
    render(<PeopleStep onChoose={vi.fn().mockResolvedValue("done")} onHistory={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Trocar bairro de ***.982.247-**" }));
    await userEvent.dblClick(await screen.findByRole("button", { name: "São Francisco" }));

    expect(await screen.findByText("Bairro atualizado.")).toBeInTheDocument();
    expect(set).toHaveBeenCalledTimes(1);
  });
});

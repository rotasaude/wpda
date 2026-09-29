import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NeighborhoodPicker } from "./NeighborhoodPicker";

const LIST = [ { id: "n1", name: "Batel" }, { id: "n2", name: "São Francisco" } ];
const noop = vi.fn();

describe("NeighborhoodPicker", () => {
  it("expõe os bairros como lista e a busca como campo de busca", () => {
    render(<NeighborhoodPicker title="t" neighborhoods={LIST} onPick={noop} onBack={noop} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("searchbox", { name: "Buscar bairro" })).toBeInTheDocument();
  });

  it("busca sem resultado avisa com role=status", async () => {
    render(<NeighborhoodPicker title="t" neighborhoods={LIST} onPick={noop} onBack={noop} />);
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum bairro encontrado com esse nome");
  });

  it("lista vazia sem busca não mostra 'nenhum bairro encontrado'", () => {
    render(<NeighborhoodPicker title="t" neighborhoods={[]} onPick={noop} onBack={noop} />);
    expect(screen.queryByText(/Nenhum bairro encontrado/)).not.toBeInTheDocument();
  });
});

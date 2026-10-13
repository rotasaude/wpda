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

  describe("usabilidade (6e, WP-14)", () => {
    const MANY = Array.from({ length: 76 }, (_, i) => ({ id: `n${i + 1}`, name: i === 0 ? "Batel" : `Bairro ${i + 1}` }));

    it("busca primeiro, 'Prefiro não informar' logo depois, e só então a lista", async () => {
      render(<NeighborhoodPicker title="t" neighborhoods={LIST} onPick={noop} onBack={noop} />);
      const search = screen.getByRole("searchbox");
      const optOut = screen.getByRole("button", { name: "Prefiro não informar" });
      const list = screen.getByRole("list");
      expect(search.compareDocumentPosition(optOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(optOut.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("muitos bairros: sem busca, nenhum botão de bairro; 'Ver todos' mostra os 76", async () => {
      render(<NeighborhoodPicker title="t" neighborhoods={MANY} onPick={noop} onBack={noop} />);
      expect(screen.queryByRole("button", { name: "Batel" })).toBeNull();
      expect(screen.getByText("Digite o nome do bairro.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Ver todos os bairros (76)" }));
      expect(screen.getAllByRole("listitem")).toHaveLength(76);
    });

    it("muitos bairros: a busca mostra só os que casam", async () => {
      render(<NeighborhoodPicker title="t" neighborhoods={MANY} onPick={noop} onBack={noop} />);
      await userEvent.type(screen.getByRole("searchbox"), "Bat");
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Batel" })).toBeInTheDocument();
    });

    it("poucos bairros aparecem logo, sem 'Ver todos'", () => {
      render(<NeighborhoodPicker title="t" neighborhoods={LIST} onPick={noop} onBack={noop} />);
      expect(screen.queryByRole("button", { name: /Ver todos/ })).toBeNull();
    });

    it("sem resultado, aponta 'Prefiro não informar'", async () => {
      render(<NeighborhoodPicker title="t" neighborhoods={LIST} onPick={noop} onBack={noop} />);
      await userEvent.type(screen.getByRole("searchbox"), "zzz");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Nenhum bairro encontrado com esse nome. Se preferir, toque em \"Prefiro não informar\".");
    });
  });
});

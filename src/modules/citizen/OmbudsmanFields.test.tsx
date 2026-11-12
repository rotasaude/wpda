import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AttachmentPicker, TextArea, UnitSelect, type PickedAttachment } from "./OmbudsmanFields";
import { ApiError, citizenApi } from "../../lib/citizenApi";

afterEach(() => { vi.restoreAllMocks(); });

function Picker({ initial = [] as PickedAttachment[] }) {
  const [ items, setItems ] = useState(initial);
  return <AttachmentPicker items={items} onChange={setItems} />;
}
const pdf = (name = "RG João Silva.pdf") => new File([ "%PDF-1" ], name, { type: "application/pdf" });
const LABEL = "Anexar arquivo (opcional)";

describe("OmbudsmanFields", () => {
  it("TextArea: rótulo, dica, contador e erro descrevem o campo; sem maxLength nativo", async () => {
    function T() { const [ v, setV ] = useState(""); return <TextArea label="O que aconteceu?" hint="Dica" error={v ? undefined : "Erro"} value={v} onChange={setV} max={4000} />; }
    const user = userEvent.setup();
    render(<T />);
    const box = screen.getByRole("textbox", { name: "O que aconteceu?" });
    expect(box).toHaveAccessibleDescription("Dica Erro");
    expect(box).not.toHaveAttribute("maxlength");
    await user.type(box, "Oi");
    expect(screen.getByText("2 de 4.000")).toBeInTheDocument();
  });

  it("TextArea: o contador conta code points depois do trim", () => {
    render(<TextArea label="Texto" value={"  😀😀  "} onChange={() => {}} max={4000} />);
    expect(screen.getByText("2 de 4.000")).toBeInTheDocument();
  });

  it("UnitSelect: opcional; vazio volta null; sem unidades não aparece", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<UnitSelect units={[ { id: "u1", name: "UBS Centro" } ]} value={null} onChange={onChange} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Unidade de saúde (opcional)" }), "u1");
    expect(onChange).toHaveBeenLastCalledWith("u1");
    await user.selectOptions(screen.getByRole("combobox"), "");
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("option", { name: "Nenhuma unidade específica" })).toBeInTheDocument();
    rerender(<UnitSelect units={[]} value={null} onChange={onChange} />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("AttachmentPicker: sobe com nome genérico, mostra só 'Anexo N', recusa tipo, tamanho e o 4º", async () => {
    const upload = vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockResolvedValueOnce({ id: "a1" });
    const user = userEvent.setup({ applyAccept: false });
    render(<Picker initial={[ { id: "a0" } ]} />);
    expect(screen.getByText("Até 3 arquivos, PDF, JPEG ou PNG, de até 10 MB cada.")).toBeInTheDocument();
    await user.upload(screen.getByLabelText(LABEL), pdf());
    expect(await screen.findByText("Anexo 2")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith({ filename: "anexo-2.pdf", contentType: "application/pdf", data: "JVBERi0x" });
    expect(document.body.textContent).not.toMatch(/João|anexo-\d/);

    await user.upload(screen.getByLabelText(LABEL), new File([ "x" ], "a.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Envie um PDF, uma foto JPEG ou PNG.");
    const big = pdf(); Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
    await user.upload(screen.getByLabelText(LABEL), big);
    expect(screen.getByRole("alert")).toHaveTextContent("O arquivo passa de 10 MB.");
    expect(upload).toHaveBeenCalledTimes(1);

    upload.mockResolvedValueOnce({ id: "a2" });
    await user.upload(screen.getByLabelText(LABEL), pdf());
    await screen.findByText("Anexo 3");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText(LABEL)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remover Anexo 2" }));
    expect(screen.queryByText("Anexo 3")).toBeNull();
    expect(screen.getByText("Anexo 2")).toBeInTheDocument();
    expect(screen.getByLabelText(LABEL)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(2); // remover só tira da lista
  });

  it.each([
    [ new ApiError(413, "http_413") ],
    [ new ApiError(413, "payload_too_large") ],
    [ new ApiError(422, "invalid_file") ],
    [ new ApiError(422, "invalid_request", "data") ]
  ])("AttachmentPicker: %o vira a frase do anexo", async (err) => {
    vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockRejectedValueOnce(err);
    const user = userEvent.setup();
    render(<Picker />);
    await user.upload(screen.getByLabelText(LABEL), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent("Envie um PDF, uma foto JPEG ou PNG, de até 10 MB.");
  });

  it("AttachmentPicker: recusa do api vira frase; upload que termina depois do desmonte não escreve", async () => {
    vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockRejectedValueOnce(new ApiError(429, "too_many_requests"));
    const user = userEvent.setup();
    const view = render(<Picker />);
    await user.upload(screen.getByLabelText(LABEL), pdf());
    expect(await screen.findByRole("alert")).toHaveTextContent("Muitos envios em pouco tempo. Tente mais tarde.");

    let resolve!: (v: { id: string }) => void;
    vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const errors = vi.spyOn(console, "error");
    await user.upload(screen.getByLabelText(LABEL), pdf());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Enviando o anexo…"));
    view.unmount();
    resolve({ id: "late" });
    await Promise.resolve();
    expect(errors).not.toHaveBeenCalled();
  });

  it("AttachmentPicker: onChange não é chamado se desmontou durante o upload", async () => {
    let resolve!: (v: { id: string }) => void;
    vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const onChange = vi.fn();
    const user = userEvent.setup();
    const view = render(<AttachmentPicker items={[]} onChange={onChange} />);
    await user.upload(screen.getByLabelText(LABEL), pdf());
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    view.unmount();
    resolve({ id: "late" });
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("AttachmentPicker: dois change no mesmo tick sobem um arquivo só", async () => {
    const upload = vi.spyOn(citizenApi, "uploadOmbudsmanAttachment").mockResolvedValue({ id: "a1" });
    render(<Picker />);
    const input = screen.getByLabelText(LABEL);
    act(() => {
      for (const f of [ pdf(), pdf("b.pdf") ]) {
        Object.defineProperty(input, "files", { value: [ f ], configurable: true });
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await screen.findByText("Anexo 1");
    await new Promise((r) => setTimeout(r, 50)); // deixa a leitura do segundo arquivo, se houve, chegar ao upload
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("AttachmentPicker: Remover limpa o erro do seletor", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Picker initial={[ { id: "a0" } ]} />);
    await user.upload(screen.getByLabelText(LABEL), new File([ "x" ], "a.gif", { type: "image/gif" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover Anexo 1" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

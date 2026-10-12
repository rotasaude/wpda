// Barra compacta de acessibilidade (eMAG), sempre no topo: pular para o
// conteúdo (aparece só com foco), página de acessibilidade e alto contraste.
import { useEffect, useRef, type MouseEvent } from "react";
import { toggleHighContrast, useThemeChoice } from "../../theme/theme";
import { openA11y, useA11yOpen } from "./a11yStore";

function focusMain(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  const main = Array.from(document.querySelectorAll("main")).find((m) => !m.closest("[hidden]"));
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus();
}

export function A11yBar() {
  const choice = useThemeChoice();
  // Ao fechar a página de acessibilidade, o foco volta ao link que a abriu
  // (o cidadão retoma de onde estava, sem recomeçar do topo).
  const open = useA11yOpen();
  const link = useRef<HTMLAnchorElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) link.current?.focus();
    wasOpen.current = open;
  }, [ open ]);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, maxWidth: 520,
      margin: "0 auto", padding: "4px 16px", fontSize: 14, background: "var(--sunken)", borderBottom: "1px solid var(--rule)" }}>
      <a href="#conteudo" className="skip-link" onClick={focusMain}>Ir para o conteúdo</a>
      <a ref={link} href="#acessibilidade" onClick={(e) => { e.preventDefault(); openA11y(); }} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
        Acessibilidade
      </a>
      <button type="button" aria-pressed={choice === "alto-contraste"} onClick={toggleHighContrast}
        style={{ minHeight: 44, background: "none", border: "none", color: "var(--accent)", textDecoration: "underline", fontSize: 14, cursor: "pointer" }}>
        Alto contraste
      </button>
    </div>
  );
}

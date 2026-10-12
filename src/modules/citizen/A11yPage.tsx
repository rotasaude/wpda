// Página de acessibilidade do wpda (eMAG 3.1), sobreposta ao conteúdo.
import { closeA11y } from "./a11yStore";
import { BigButton } from "./ui";
import { CityHeader } from "./CityHeader";

export function A11yPage() {
  return (
    <section aria-labelledby="a11y-title" style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px 16px" }}>
      <header style={{ margin: "16px 0" }}>
        <CityHeader />
        <h1 id="a11y-title" style={{ fontSize: 24, margin: "4px 0 0" }}>Acessibilidade</h1>
      </header>
      <p>Este serviço segue a WCAG 2.2 nível AA e o eMAG 3.1.</p>
      <ul style={{ paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Alto contraste no botão do topo. Sem ele, as cores seguem o modo claro ou escuro do seu celular.</li>
        <li>Botões grandes, fáceis de tocar.</li>
        <li>O nível de risco aparece por cor, forma (■ alto, ▲ moderado, ● baixo) e texto.</li>
        <li>Títulos e rótulos para leitores de tela.</li>
      </ul>
      <p>Encontrou um problema? Procure a unidade de saúde ou a prefeitura.</p>
      <BigButton variant="secondary" onClick={closeA11y}>Voltar</BigButton>
    </section>
  );
}

import { tokenFromUrl } from "./lib/report";
import { Report } from "./modules/Report";
import { BackHomeLink } from "./modules/BackHomeLink";
import { Flow } from "./modules/citizen/Flow";
import { A11yBar } from "./modules/citizen/A11yBar";
import { A11yPage } from "./modules/citizen/A11yPage";
import { useA11yOpen } from "./modules/citizen/a11yStore";
import { PhoneOnly } from "./modules/citizen/PhoneOnly";
import { isPhone } from "./lib/device";

// Barra de acessibilidade sempre no topo; a página de acessibilidade é
// sobreposta e o conteúdo fica hidden (sem desmontar: o fluxo não perde o
// passo em que estava).
export function App() {
  const token = tokenFromUrl();
  const a11y = useA11yOpen();
  // O relatório abre em qualquer tela; o fluxo do cidadão, só no celular
  // (decisão 9 do ciclo de interface).
  const content = token
    ? <Report token={token}><BackHomeLink /></Report>
    : isPhone() ? <Flow /> : <PhoneOnly />;
  return (
    <>
      <A11yBar />
      {a11y && <A11yPage />}
      <div hidden={a11y}>{content}</div>
    </>
  );
}

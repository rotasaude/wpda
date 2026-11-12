import { useState } from "react";
import { tokenFromUrl } from "./lib/report";
import { Report } from "./modules/Report";
import { BackHomeLink } from "./modules/BackHomeLink";
import { Flow } from "./modules/citizen/Flow";
import { A11yBar } from "./modules/citizen/A11yBar";
import { A11yPage } from "./modules/citizen/A11yPage";
import { useA11yOpen } from "./modules/citizen/a11yStore";
import { PhoneOnly } from "./modules/citizen/PhoneOnly";
import { OmbudsmanEntry } from "./modules/citizen/OmbudsmanEntry";
import { AnonymousReportStep } from "./modules/citizen/AnonymousReportStep";
import { isPhone } from "./lib/device";
import { desktopAllowed } from "./lib/desktopAllowed";
import { TestEnvBanner } from "./modules/citizen/TestEnvBanner";

// Barra de acessibilidade sempre no topo; a página de acessibilidade é
// sobreposta e o conteúdo fica hidden (sem desmontar: o fluxo não perde o
// passo em que estava).
export function App() {
  const token = tokenFromUrl();
  const a11y = useA11yOpen();
  // Fora do celular, só a denúncia anônima (U2): estado local, sem rota, sem sessão, sem cookie.
  const [ anonymous, setAnonymous ] = useState(false);
  // O relatório e a denúncia anônima abrem em qualquer tela; o resto do fluxo
  // do cidadão, só no celular (decisão 9 do ciclo de interface), exceto em dev
  // e staging (wpda#2).
  const testEnv = desktopAllowed();
  const content = token
    ? <Report token={token}><BackHomeLink /></Report>
    : isPhone() || testEnv ? <Flow />
    : anonymous ? <AnonymousReportStep offPhone onBack={() => setAnonymous(false)} />
    : <PhoneOnly><OmbudsmanEntry onAnonymous={() => setAnonymous(true)} /></PhoneOnly>;
  return (
    <>
      {testEnv && <TestEnvBanner />}
      <A11yBar />
      {a11y && <A11yPage />}
      <div hidden={a11y}>{content}</div>
    </>
  );
}

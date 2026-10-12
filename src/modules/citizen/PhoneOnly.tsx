// Fora do celular, o fluxo do cidadão não abre (decisão 9 do ciclo).
import { CityHeader } from "./CityHeader";
import { EmergencyCall } from "./EmergencyCall";

export function PhoneOnly() {
  const address = window.location.origin + window.location.pathname;
  return (
    <main id="conteudo" style={{ maxWidth: 520, margin: "0 auto", padding: "16px" }}>
      <header style={{ marginBottom: 16 }}>
        <CityHeader />
        <h1 style={{ fontSize: 24, margin: "4px 0 0" }}>Abra no celular</h1>
      </header>
      <p>Este serviço foi feito para ser usado no celular. Abra este endereço no seu celular.</p>
      <p><code style={{ fontSize: 18, userSelect: "all", overflowWrap: "anywhere" }}>{address}</code></p>
      <EmergencyCall />
    </main>
  );
}

// Identidade da cidade (GET /city_identity, mesma origem, sem sessão; rotasaude/api#73).
// ADR 0025: sem pacote compartilhado — o tipo é redeclarado em cada app.
export type CityIdentity = {
  name: string;
  uf: string | null;
  time_zone: string;
  health_department_name: string | null;
  coat_of_arms_url: string | null;
};

// Uma requisição por carregamento de página; qualquer falha vira null.
let memo: Promise<CityIdentity | null> | null = null;

export function loadCityIdentity(): Promise<CityIdentity | null> {
  memo ??= fetch("/city_identity", { credentials: "same-origin", headers: { Accept: "application/json" } })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = await res.json();
      return body && typeof body.name === "string" && body.name ? (body as CityIdentity) : null;
    })
    .catch(() => null);
  return memo;
}

export function resetCityIdentityForTests(): void { memo = null; }

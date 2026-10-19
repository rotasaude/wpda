import { useEffect, useState } from "react";
import { loadCityIdentity, type CityIdentity } from "./cityIdentity";

export function useCityIdentity(): CityIdentity | null {
  const [ identity, setIdentity ] = useState<CityIdentity | null>(null);
  useEffect(() => {
    let alive = true;
    loadCityIdentity().then((id) => { if (alive) setIdentity(id); });
    return () => { alive = false; };
  }, []);
  return identity;
}

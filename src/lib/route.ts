// src/lib/route.ts
// Endereços próprios do wpda (spec 2026-09-29 §8): o link do SMS é
// <base>/avisos. O resto do canal segue sem URL: é a máquina de telas do Flow.
export type AppRoute = "avisos" | "preferencias";

const ROUTES: readonly string[] = [ "avisos", "preferencias" ];

function withSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}

export function routeFromPath(pathname: string, base: string): AppRoute | null {
  const b = withSlash(base);
  const path = pathname.replace(/\/{2,}/g, "/");
  if (!path.startsWith(b)) return null;
  const rest = path.slice(b.length).replace(/\/+$/, "");
  return ROUTES.includes(rest) ? (rest as AppRoute) : null;
}

export function pathFor(route: AppRoute | null, base: string): string {
  return route ? `${withSlash(base)}${route}` : withSlash(base);
}

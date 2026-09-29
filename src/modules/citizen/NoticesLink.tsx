// src/modules/citizen/NoticesLink.tsx
// Link "Avisos" do topo das telas logadas (spec 2026-09-29 §8), com o selo de
// não lidos. O api já desconta quem silenciou (unread_count 0 = sem selo).
// Falha ao buscar (api antiga, rede) = link sem selo e sem erro.
import { useEffect, useState, type MouseEvent } from "react";
import { citizenApi } from "../../lib/citizenApi";

export function badgeText(count: number): string | null {
  if (!(count > 0)) return null;
  return count > 99 ? "99+" : String(count);
}

export function NoticesLink({ onOpen }: { onOpen: () => void }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    citizenApi.notices()
      .then(r => { if (alive) setUnread(r.unread_count); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const badge = badgeText(unread);
  const label = badge ? `Avisos, ${unread} ${unread === 1 ? "novo" : "novos"}` : "Avisos";

  function open(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    onOpen();
  }

  // base do Vite ("/wpda/"), lida no render (os testes trocam com vi.stubEnv).
  return (
    <a href={`${import.meta.env.BASE_URL}avisos`} aria-label={label} onClick={open}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 12px",
        borderRadius: 12, fontSize: 18, fontWeight: 600, textDecoration: "none",
        color: "var(--ink, #222)", border: "1px solid var(--rule2, #ccc)" }}>
      <span>Avisos</span>
      {badge && (
        <span aria-hidden="true"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 32,
            height: 32, padding: "0 8px", borderRadius: 16, fontSize: 18,
            background: "var(--down, #c0392b)", color: "#fff" }}>
          {badge}
        </span>
      )}
    </a>
  );
}

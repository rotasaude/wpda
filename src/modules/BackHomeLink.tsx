// Saída do relatório público (/r/:token): leva à entrada do wpda. Não mostra
// unidade de referência nem bairro (decisão do usuário, 2026-09-28).
export function BackHomeLink() {
  // base do Vite ("/wpda/"): a entrada do cidadão, não a raiz do site.
  const home = import.meta.env.BASE_URL ?? "/";
  return (
    <a href={home} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 56,
      borderRadius: 12, fontSize: 18, fontWeight: 600, textDecoration: "none",
      color: "var(--ink, #222)", border: "1px solid var(--rule2, #ccc)" }}>
      Voltar ao início
    </a>
  );
}

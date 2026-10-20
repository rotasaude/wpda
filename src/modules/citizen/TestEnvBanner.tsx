// Faixa de ambiente de teste (rotasaude/wpda#2): aparece sempre que o desktop
// está liberado, para ninguém confundir dev ou staging com produção.
export function TestEnvBanner() {
  return (
    <div role="note" aria-label="Aviso de ambiente de teste"
      style={{ padding: "4px 16px", fontSize: 14, fontWeight: 600, textAlign: "center",
        background: "var(--warn-bg)", color: "var(--ink)", borderBottom: "1px solid var(--warn)" }}>
      Modo desktop — ambiente de teste
    </div>
  );
}

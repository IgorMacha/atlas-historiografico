"use client";
import { useEffect } from "react";
export default function BotaoImprimir({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 2500); // espera mapas e fontes carregarem
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <div className="nao-imprimir" style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", borderBottom: "1px solid #ddd", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn pri" onClick={() => window.print()}>Salvar como PDF</button>
      <span className="small muted">Na janela de impressão, escolha “Salvar como PDF”, papel A4 e desative “Cabeçalhos e rodapés”.</span>
    </div>
  );
}

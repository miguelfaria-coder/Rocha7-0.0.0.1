/* utils.js - Funções compartilhadas da vitrine Rocha7 */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBRL(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const CORES_HEX = {
  branco: "#f7f7f5",
  preto: "#161616",
  cinza: "#8a8f94",
  "azul-marinho": "#0d233a",
  rosa: "#e8a0bf"
};

export function hexDaCor(nome) {
  if (!nome) return "#cccccc";
  const key = String(nome).toLowerCase().trim();
  return CORES_HEX[key] || nome;
}

if (typeof window !== "undefined") {
  window.escapeHtml = escapeHtml;
  window.formatBRL = formatBRL;
  window.hexDaCor = hexDaCor;
}

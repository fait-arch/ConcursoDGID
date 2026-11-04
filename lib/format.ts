/** Color de texto legible (oscuro o claro) sobre un fondo del color dado. */
export function inkFor(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.36 ? "#14151D" : "#FFFFFF";
}

/** 2384 → "2,38 s" */
export function seconds(ms: number, digits = 2): string {
  return `${(ms / 1000).toFixed(digits).replace(".", ",")} s`;
}

export function points(n: number): string {
  return n.toLocaleString("es");
}

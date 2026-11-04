/** Icono de Material Symbols Rounded (fuente local, funciona sin internet). */
export default function Icon({ name, filled, className }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span className={`ms${filled ? " ms-fill" : ""}${className ? ` ${className}` : ""}`} aria-hidden>
      {name}
    </span>
  );
}

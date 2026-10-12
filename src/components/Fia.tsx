export type Animo = "tranqui" | "contenta" | "pensando" | "duda";

const TINTA = "var(--color-tinta)";

function Ojos({ animo }: { animo: Animo }) {
  if (animo === "contenta") {
    return (
      <g fill="none" stroke={TINTA} strokeWidth="2.6" strokeLinecap="round">
        <path d="M20.5 31.5q3.5-5 7 0" />
        <path d="M36.5 31.5q3.5-5 7 0" />
      </g>
    );
  }
  const [dx, dy] = animo === "pensando" ? [1.6, -2.2] : [0, 0];
  return (
    <g className="ojos-fia animate-parpadeo" fill={TINTA}>
      <ellipse cx={24 + dx} cy={30 + dy} rx="2.9" ry="3.8" />
      <ellipse cx={40 + dx} cy={30 + dy} rx="2.9" ry={animo === "duda" ? 4.6 : 3.8} />
      <circle cx={25 + dx} cy={28.6 + dy} r="0.9" fill="#fff" />
      <circle cx={41 + dx} cy={28.6 + dy} r="0.9" fill="#fff" />
    </g>
  );
}

function Boca({ animo }: { animo: Animo }) {
  const trazo = { fill: "none", stroke: TINTA, strokeWidth: 2.4, strokeLinecap: "round" as const };
  switch (animo) {
    case "contenta":
      return <path d="M26 38.5q6 7.5 12 0z" fill={TINTA} stroke={TINTA} strokeWidth="2" strokeLinejoin="round" />;
    case "pensando":
      return <path d="M29 41h6" {...trazo} />;
    case "duda":
      return <path d="M28 41.5q3-2.6 8-.4" {...trazo} />;
    default:
      return <path d="M27 39q5 4.6 10 0" {...trazo} />;
  }
}

/**
 * Fia: un ticket rosa con cara. El borde de abajo es el mismo troquelado de los
 * tickets que entrega en el chat.
 */
export function Fia({ animo = "tranqui", className }: { animo?: Animo; className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true">
      <path
        d="M8 66V28C8 14.7 18.7 6 32 6s24 8.7 24 22v38l-6-6-6 6-6-6-6 6-6-6-6 6-6-6z"
        fill="var(--color-rosa)"
        stroke="var(--color-birome)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {animo === "duda" && <path d="M36.5 22.5q3.5-2.6 7-.8" fill="none" stroke={TINTA} strokeWidth="2" strokeLinecap="round" />}
      <circle cx="16.5" cy="38" r="3.4" fill="var(--color-rosa-oscuro)" opacity="0.75" />
      <circle cx="47.5" cy="38" r="3.4" fill="var(--color-rosa-oscuro)" opacity="0.75" />
      <Ojos animo={animo} />
      <Boca animo={animo} />
      <g stroke="var(--color-birome)" strokeWidth="2" strokeLinecap="round" opacity="0.4">
        <path d="M21 50h22" />
        <path d="M21 55h13" />
      </g>
    </svg>
  );
}

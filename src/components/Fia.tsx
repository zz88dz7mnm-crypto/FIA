/** El símbolo de Fia: un signo de pesos, sin más. */
export function Fia({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="24" className="fill-verde" />
      <g className="fill-none stroke-white" strokeWidth="3.4" strokeLinecap="round">
        <path d="M30.5 17.5c-1.2-2.6-3.6-4-6.7-4-4 0-6.8 2.2-6.8 5.4 0 7.2 14 3.6 14 10.7 0 3.3-2.9 5.5-7 5.5-3.4 0-6-1.5-7.2-4.3" />
        <path d="M24 9.5v29" />
      </g>
    </svg>
  );
}

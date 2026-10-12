/** Íconos de trazo fino, todos con la misma caja y el mismo grosor. */
function Trazo({ className = "size-6", children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconoImagen = ({ className }: { className?: string }) => (
  <Trazo className={className}>
    <rect x="3.5" y="5" width="17" height="14" rx="3.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m5 17 4.2-4.2a1.5 1.5 0 0 1 2.1 0L15 16.5l1.7-1.7a1.5 1.5 0 0 1 2.1 0l1.7 1.7" />
  </Trazo>
);

export const IconoEnviar = ({ className }: { className?: string }) => (
  <Trazo className={className}>
    <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" strokeWidth="2.4" />
  </Trazo>
);

export const IconoPanel = ({ className }: { className?: string }) => (
  <Trazo className={className}>
    <path d="M5 20V11M12 20V4M19 20v-6" strokeWidth="2.6" />
  </Trazo>
);

export const IconoChat = ({ className }: { className?: string }) => (
  <Trazo className={className}>
    <path d="M12 4c-4.7 0-8.5 3.2-8.5 7.2 0 2.2 1.2 4.2 3 5.5L6 20l3.8-1.9c.7.1 1.4.2 2.2.2 4.7 0 8.5-3.2 8.5-7.1S16.7 4 12 4Z" />
  </Trazo>
);

export const IconoMas = ({ className = "size-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);

export const IconoFlecha = ({ arriba, className = "size-3.5" }: { arriba: boolean; className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={arriba ? "M8 13V3M3.5 7.5 8 3l4.5 4.5" : "M8 3v10M3.5 8.5 8 13l4.5-4.5"} />
  </svg>
);

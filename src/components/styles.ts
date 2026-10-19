// Clases de Tailwind compartidas, para que botones y campos se vean igual en
// la reserva pública y en el panel. Forma del sistema: radio de 15 px en
// botones y píldoras, 12 px en tarjetas, todo plano (sin sombras).

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonBase = `inline-flex items-center justify-center gap-1.5 rounded-[15px] px-3.5 py-2.5 text-sm font-semibold uppercase tracking-[0.04em] transition-colors disabled:cursor-wait disabled:opacity-60 ${focusRing}`;

export const button = {
  /** Acción principal: cobre lleno. */
  primary: `${buttonBase} bg-accent text-accent-foreground hover:bg-soft`,
  /** Acción secundaria: fantasma con borde, para acompañar a la principal. */
  secondary: `${buttonBase} border border-line text-foreground hover:border-soft hover:text-soft`,
  danger: `${buttonBase} border border-danger text-danger hover:bg-danger hover:text-accent-foreground`,
  small: "!px-3 !py-1.5 !text-xs",
};

/** Píldora elegible (días, horarios, filtros): cobre cuando está activa. */
export const pill = (active: boolean) =>
  `rounded-[15px] border transition-colors ${focusRing} ${
    active
      ? "border-accent bg-accent text-accent-foreground"
      : "border-line text-soft hover:border-accent hover:text-foreground"
  }`;

export const card = "rounded-xl border border-border bg-card p-5 sm:p-6";

export const inputClass = (invalid?: boolean) =>
  `w-full rounded-xl border bg-background px-3 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/30 ${
    invalid ? "border-danger" : "border-line"
  }`;

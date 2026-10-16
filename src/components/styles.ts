// Clases de Tailwind compartidas, para que botones y campos se vean igual en
// la reserva pública y en el panel.

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const buttonBase = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-opacity disabled:cursor-wait disabled:opacity-60 ${focusRing}`;

export const button = {
  primary: `${buttonBase} bg-accent px-4 py-2.5 text-accent-foreground hover:opacity-90`,
  secondary: `${buttonBase} border border-border bg-card px-4 py-2.5 hover:bg-background`,
  danger: `${buttonBase} bg-danger px-4 py-2.5 text-white hover:opacity-90`,
  small: "!px-3 !py-1.5 text-sm",
};

export const card = "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";

export const inputClass = (invalid?: boolean) =>
  `w-full rounded-xl border bg-background px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 ${
    invalid ? "border-danger" : "border-border"
  }`;

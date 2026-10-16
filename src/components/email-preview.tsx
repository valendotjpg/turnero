/**
 * Vista previa de un email. El HTML se muestra en un iframe aislado (sandbox
 * sin scripts ni acceso al resto de la página), como haría un cliente de correo.
 */
export function EmailPreview({ subject, to, html }: { subject: string; to: string; html: string }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-card">
      <figcaption className="border-b border-border px-4 py-3 text-sm">
        <p className="font-semibold">{subject}</p>
        <p className="text-muted">Para: {to}</p>
      </figcaption>
      <iframe
        title={`Vista previa: ${subject}`}
        srcDoc={html}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        className="h-[34rem] w-full bg-white"
      />
    </figure>
  );
}

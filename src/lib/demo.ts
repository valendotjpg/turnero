// Cuenta del negocio de demostración que crea el seed. Son credenciales
// públicas a propósito: sirven para probar el panel.
export const DEMO_BUSINESS_SLUG = "barberia-demo";
export const DEMO_OWNER_EMAIL = "duenio@barberia-demo.test";
export const DEMO_OWNER_PASSWORD = "turnero-demo";

/**
 * Modo demo (la instancia pública del portfolio): los emails no salen de la
 * app y se pueden ver desde el panel y desde la página del turno; los datos
 * se reinician todos los días.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** ¿Mostrar las credenciales de demo en el login? Nunca en un negocio real. */
export function showDemoCredentials(): boolean {
  return isDemoMode() || process.env.NODE_ENV === "development";
}

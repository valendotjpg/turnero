// Invoca /api/cron una vez, como lo haría el cron de producción.
// Uso: npm run cron   (con `npm run dev` corriendo)

import "dotenv/config";

const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/api/cron`;
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
});

console.log(`${response.status} ${url}`);
console.log(await response.text());
process.exitCode = response.ok ? 0 : 1;

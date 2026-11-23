import { spawnSync } from "node:child_process";

if (process.env.SEED_ON_BUILD !== "true") {
  console.log("SEED_ON_BUILD no es true; se omite el seed.");
  process.exit(0);
}

console.log("SEED_ON_BUILD=true; seed idempotente. No se imprime ninguna contraseña.");
const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);

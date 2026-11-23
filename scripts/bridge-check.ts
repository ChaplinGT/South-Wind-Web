import { getBridge } from "../lib/bridge";
import { BridgeError } from "../lib/bridge/errors";
import { summarizeCustomers } from "../lib/bridge/webhook";
import { isMockMode } from "../lib/env";

async function main() {
  if (isMockMode()) {
    const body = await getBridge().listCustomers();
    const summary = summarizeCustomers(body);
    console.log("mode=mock");
    console.log("http_status=200");
    console.log(`count=${summary.count}`);
    console.log(`statuses=${JSON.stringify(summary.statuses)}`);
    console.log("note=no se llamó a la red porque BRIDGE_MOCK no es false");
    return;
  }
  if (!process.env.BRIDGE_API_KEY) {
    console.error("BRIDGE_API_KEY no está configurada. Defina la clave de sandbox en el servidor.");
    process.exit(1);
  }
  try {
    const body = await getBridge().listCustomers({ limit: 100 });
    const summary = summarizeCustomers(body);
    console.log("mode=sandbox");
    console.log("http_status=200");
    console.log(`count=${summary.count}`);
    console.log(`statuses=${JSON.stringify(summary.statuses)}`);
  } catch (error) {
    const status = error instanceof BridgeError ? error.status : 0;
    console.log("mode=sandbox");
    console.log(`http_status=${status}`);
    console.log("count=");
    console.log("statuses={}");
    console.error("No se pudo leer GET /customers. La clave no se imprime.");
    process.exit(1);
  }
}

main();

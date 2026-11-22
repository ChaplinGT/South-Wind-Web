# Portal de clientes · South Wind Global Services LLC

Portal en español (Bolivia) para las empresas que mueven pagos con South Wind. La operación de dólares y stablecoins pasa por [Bridge](https://apidocs.bridge.xyz/get-started/introduction/overview) (empresa de Stripe). El cliente no entra al panel de Bridge: habla solo con este portal, y el servidor llama al API.

South Wind no es un banco. La conversión entre USDC y bolivianos no está automatizada: queda como **solicitud de conversión**, atendida fuera de la plataforma por un PSAV licenciado en Bolivia.

Este repositorio corre en **sandbox** y, sin clave, en **modo simulado**.

## Qué incluye

- Página pública de los tres perfiles: importador, empresa con cuenta en Estados Unidos y exportador.
- Acceso con roles `admin` y `client`.
- Alta de empresas nuevas y enlace de verificación KYB de Bridge. En simulación, el enlace abre una pantalla local.
- Vinculación de clientes que ya existen en la cuenta de desarrollador de South Wind, usando su `customer_id`, sin repetir el KYB.
- Cuenta al estilo de un banco: saldo en USDC, instrucciones de la cuenta virtual, beneficiarios (ACH, wire, SEPA, SPEI, Pix, Faster Payments), envío con confirmación y comisión, solicitudes de conversión y movimientos con filtros.
- Extracto de cuenta en PDF (logo, razón social, NIT, período, saldos, movimientos y código de verificación con página pública) y comprobantes por operación.
- Panel de administración: clientes, transferencias, conversiones, comisión y auditoría.
- Webhook `POST /api/webhooks/bridge` con la verificación de firma de Bridge (`X-Webhook-Signature`, doble SHA-256 y RSA).
- Claves de idempotencia en los POST que mueven dinero, validación y mensajes de error en español.

## Marca

Los PNG oficiales están en `public/brand/`:

| Archivo | Uso |
| --- | --- |
| `logo-horizontal.png` | Encabezado, pie, extractos y comprobantes |
| `logo-stacked.png` | Pantalla de ingreso |
| `logo-wordmark.png` | Reserva de wordmark |
| `logo-mark.png` | Favicon e icono de la app |

El teal de la interfaz es **`#25656F`**, el color más frecuente del fondo de esos PNG (rgb 37, 101, 111). En fondos claros se usa el propio archivo (ya trae el bloque teal) o, cuando hace falta el dibujo suelto, las variantes `*-on-light.png` y `logo-outline-transparent.png`: el mismo trazo, recoloreado a `#25656F` sobre transparencia.

Para reemplazar la marca, conserve los nombres de archivo.

## Correr en local

Requiere Node 20 o superior y Postgres.

Con Docker:

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

`DATABASE_URL` y `DATABASE_URL_UNPOOLED` apuntan, en local, a la misma base (`postgresql://southwind:southwind@localhost:5432/southwind`). `npm run db:setup` aplica las migraciones y siembra la demo. `npm run db:seed` se puede repetir: no borra empresas que ya existen.

Sin Docker, una rama gratis de [Neon](https://neon.tech) sirve igual. Copie la URL con pooler a `DATABASE_URL` y la URL directa a `DATABASE_URL_UNPOOLED`.

### Accesos de demostración

Contraseña de todos: `VientoSur-2026`

| Perfil | Correo |
| --- | --- |
| Administración | `admin@southwind.example` |
| Importadora Andina | `maria.quispe@importadora-andina.example` |
| Altiplano Textil | `juan.choque@altiplano-textil.example` |
| Quinua Real | `lucia.mamani@quinua-real.example` |
| Café de los Yungas | `carlos.condori@cafe-yungas.example` |

En la pantalla de ingreso, con el modo simulado activo, hay botones para entrar con esas cuentas.

El extracto de octubre de 2026 de Importadora Andina ya está generado. Su código de verificación es `SW-ANDI-4F7Q` (http://localhost:3000/verificar/SW-ANDI-4F7Q).

En modo simulado hay un quinto cliente de Bridge que todavía no está en el portal: **Distribuidora Illimani**, `customer_id` `e55e55e5-5555-4555-8555-555555555555`. Desde Administración → Vincular cliente se puede enlazar sin repetir el KYB.

## Variables de entorno

Vea `.env.example`. Ninguna clave debe commitearse. `BRIDGE_API_KEY` solo se lee en el servidor: no use el prefijo `NEXT_PUBLIC_`.

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Postgres de runtime. En Neon, la URL con pooler |
| `DATABASE_URL_UNPOOLED` | Postgres directo, para `prisma migrate deploy` |
| `BRIDGE_API_KEY` | Clave de sandbox o de producción. Si falta, el portal queda simulado |
| `BRIDGE_API_BASE_URL` | Por defecto `https://api.sandbox.bridge.xyz/v0` |
| `BRIDGE_MOCK` | Con clave y `false`, llama a Bridge. Sin clave, siempre simula |
| `BRIDGE_WEBHOOK_PUBLIC_KEY` | PEM público que devuelve Bridge al crear el webhook |
| `AUTH_SECRET` | Firma de la cookie de sesión. Cámbielo |
| `APP_URL` | URL pública de los QR y del KYB. Alias aceptado: `NEXTAUTH_URL` |
| `ADMIN_EMAIL` | Opcional. Correo del admin que crea `npm run db:seed` |
| `ADMIN_PASSWORD` | Opcional. Si está, el seed la aplica y no usa la clave de demo |
| `SOUTH_WIND_FEE_PERCENT` | Comisión inicial si todavía no hay valor guardado. El panel la puede cambiar |

## Modo simulado

Sin `BRIDGE_API_KEY`, o con `BRIDGE_MOCK` distinto de `false`, el servidor no llama a Bridge. Los clientes, billeteras, cuentas virtuales, cuentas externas y transferencias siguen la forma documentada del API (`count` + `data`, `status`, `endorsements`, `source_deposit_instructions`, `developer_fee`, estados de transferencia). Los POST respetan `Idempotency-Key`.

La verificación de una empresa nueva abre `/sandbox/kyb/...` en lugar del enlace real. El depósito de prueba de la cuenta virtual usa el mismo concepto que `simulate_deposit` del sandbox.

## Conectar la clave de sandbox

1. En el dashboard de Bridge, cree una clave del entorno **sandbox**. Se muestra una sola vez.
2. En `.env`:

   ```bash
   BRIDGE_API_KEY=la-clave-que-copió
   BRIDGE_API_BASE_URL=https://api.sandbox.bridge.xyz/v0
   BRIDGE_MOCK=false
   ```

3. No imprima la clave ni la ponga en el cliente. Reinicie `npm run dev`.
4. Compruebe el acceso, solo con conteos y estados:

   ```bash
   npm run bridge:check
   ```

   Imprime `mode`, `http_status`, `count` y `statuses`. Si la clave falta o Bridge rechaza la llamada, no escribe la clave.

5. Los clientes que ya existen se vinculan en **Administración → Vincular cliente** con su `customer_id`. El alta nueva crea el customer con `POST /customers` y pide el enlace con `GET /customers/{id}/kyc_link`.
6. Para webhooks, cree el endpoint en Bridge apuntando a `https://su-dominio/api/webhooks/bridge`, categorías `customer`, `transfer` y `virtual_account.activity`, y guarde el `public_key` PEM en `BRIDGE_WEBHOOK_PUBLIC_KEY`. En `.env` puede ir en una línea, con `\n`. Active el webhook con `PUT /webhooks/{id}` y `"status": "active"`. Sin esa clave pública el endpoint responde 400.

Producción, cuando corresponda, cambia la base a `https://api.bridge.xyz/v0` y usa otra clave y otro webhook. Sandbox y producción no comparten datos.

## Scripts

```bash
npm run dev          # servidor local
npm test             # cliente de Bridge, firma, extracto, comisión y validación
npm run bridge:check # GET /customers, solo conteos y estados
npm run db:setup     # migraciones + demo (idempotente)
npm run db:seed      # solo la demo, contra la DATABASE_URL actual
npm run build        # prisma generate + next build
```

En Vercel el comando de build es `npm run vercel-build`: `prisma generate`, `prisma migrate deploy`, el seed solo si `SEED_ON_BUILD=true`, y `next build`.

## Despliegue en Vercel (plan Hobby, modo de prueba)

1. Importe el repositorio en Vercel. Framework: Next.js. El build usa `vercel-build`.
2. En Storage, agregue Postgres de Neon por el Marketplace. Eso inyecta `DATABASE_URL` (pooler) y `DATABASE_URL_UNPOOLED` (directa). Prisma lee exactamente esos dos nombres. Si en cambio ve `POSTGRES_URL` y `POSTGRES_URL_NON_POOLING`, copie la URL con pooler a `DATABASE_URL` y la directa a `DATABASE_URL_UNPOOLED`.
3. Variables que hay que definir a mano:

   | Variable | Valor en la prueba |
   | --- | --- |
   | `AUTH_SECRET` | cadena larga aleatoria |
   | `APP_URL` | `https://<proyecto>.vercel.app` y, después, `https://portal.southwindglobalservices.com` |
   | `BRIDGE_API_BASE_URL` | `https://api.sandbox.bridge.xyz/v0` |
   | `BRIDGE_MOCK` | `true` mientras no haya clave. `false` solo junto con `BRIDGE_API_KEY` |
   | `BRIDGE_API_KEY` | vacía para simular, o la clave de sandbox |
   | `BRIDGE_WEBHOOK_PUBLIC_KEY` | PEM, cuando cree el webhook |
   | `ADMIN_EMAIL` | correo real del administrador |
   | `ADMIN_PASSWORD` | clave que no sea la de demostración |
   | `SOUTH_WIND_FEE_PERCENT` | `0.50` |
   | `SEED_ON_BUILD` | `true` en el deploy que debe sembrar; `false` después |

   `DATABASE_URL` y `DATABASE_URL_UNPOOLED` las pone Neon. No las marque como solo de runtime: `migrate deploy` y, si el flag está activo, el seed corren durante el build y leen esas variables ahí. El seed no imprime contraseñas. Si `ADMIN_EMAIL` no es un correo, el build falla y no escribe ese valor. Después de crear el admin vigente, desactiva cualquier otro usuario con rol admin; si ese correo no es válido y no tiene auditoría asociada, lo elimina.

4. Despliegue con `SEED_ON_BUILD=true`. Las migraciones corren y después el seed idempotente crea el admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) y las cuatro empresas de demostración. Un segundo build con el flag sigue sin duplicarlas. Luego puede poner `SEED_ON_BUILD=false` para que los builds siguientes solo migren.
5. `/login` redirige a `/ingresar`.

Los PDF se generan en la función al pedirlos. El logo y las fuentes DejaVu van dentro del despliegue. Los comprobantes de conversión se guardan en Postgres, no en disco. El estado simulado de Bridge también vive en la base, así que sobrevive entre invocaciones.

## Qué falta para producción

## Qué falta para producción

- Dominio, TLS y `APP_URL` definitivo.
- Textos legales revisados: condiciones de uso, privacidad, y el aviso de que South Wind no es un banco.
- Domicilio registrado en Montana, en lugar del marcador de posición.
- Tarifa comercial real (hoy la comisión es un marcador, por defecto 0,50 %, editable en el panel).
- Requisitos de la UIF y del PSAV para la pata en bolivianos. Esa conversión sigue siendo manual: este portal solo registra la solicitud, el estado y el comprobante.
- Clave, webhook y clientes del entorno de producción de Bridge, separados del sandbox.
- Correo de invitación, segundo factor, respaldos y una revisión de seguridad.
- Dominio `portal.southwindglobalservices.com` en `APP_URL`.
- Quitar la marca de agua de demostración: desaparece cuando hay clave de Bridge y `BRIDGE_MOCK=false`.

## Notas de integración

- Encabezado de Bridge: `Api-Key`. En cada POST, `Idempotency-Key`. No se envía en GET.
- La comisión de South Wind viaja como `developer_fee` en `POST /transfers`. El origen del MVP es la billetera custodial (`bridge_wallet` / USDC) y el destino es la cuenta externa del beneficiario.
- La cuenta virtual de recepción liquida a USDC. El saldo que ve el cliente y el que arma el extracto es el libro interno del portal, actualizado al enviar, al acreditar un depósito y al marcar una conversión como pagada.
- Un pago devuelto o cancelado, avisado por webhook, revierte el cargo en el libro.

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

Requiere Node 20 o superior.

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Abra http://localhost:3000.

`npm run db:setup` crea la base SQLite (`prisma/dev.db`) y carga datos de demostración. Volver a ejecutar `npm run db:seed` **borra** esos datos y los recrea.

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
| `DATABASE_URL` | SQLite local (`file:./dev.db`) o Postgres |
| `BRIDGE_API_KEY` | Clave de sandbox o de producción |
| `BRIDGE_API_BASE_URL` | Por defecto `https://api.sandbox.bridge.xyz/v0` |
| `BRIDGE_MOCK` | `true` usa fixtures locales. `false` llama a Bridge |
| `BRIDGE_WEBHOOK_PUBLIC_KEY` | PEM público que devuelve Bridge al crear el webhook |
| `AUTH_SECRET` | Firma de la cookie de sesión. Cámbielo |
| `APP_URL` | URL pública, para verificación de extractos y el KYB simulado |
| `SOUTH_WIND_FEE_PERCENT` | Comisión inicial si todavía no hay valor guardado. El panel la puede cambiar |

## Modo simulado

Con `BRIDGE_MOCK` distinto de `false` (es el valor de `.env.example`) el servidor no llama a Bridge. Los clientes, billeteras, cuentas virtuales, cuentas externas y transferencias siguen la forma documentada del API (`count` + `data`, `status`, `endorsements`, `source_deposit_instructions`, `developer_fee`, estados de transferencia). Los POST respetan `Idempotency-Key`.

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
npm run db:setup     # crear tablas y sembrar la demo
npm run build        # compilación de producción
```

## Despliegue (Vercel + Supabase)

1. Cree un proyecto de Supabase y copie la URI de Postgres.
2. En `prisma/schema.prisma` cambie `provider = "sqlite"` por `provider = "postgresql"`. El resto del esquema usa textos y fechas, así que no hay que reescribir modelos. Si usa el pooler, deje `DATABASE_URL` con el pooler y agregue `directUrl` para migraciones, como indica Prisma.
3. En la máquina de despliegue: `npx prisma db push` (o migraciones) y, si quiere la demo, `npm run db:seed`. En producción real no siembre las empresas de ejemplo.
4. En Vercel configure las mismas variables del `.env`. `BRIDGE_API_KEY`, `AUTH_SECRET` y `BRIDGE_WEBHOOK_PUBLIC_KEY` son secretos de servidor.
5. `APP_URL` debe ser la URL pública (`https://…`) para que el QR del extracto apunte al portal.
6. SQLite no sirve en las funciones de Vercel. Producción usa Postgres.

Los archivos de `storage/` (comprobantes subidos y el estado simulado) viven en el disco local. En Vercel hay que moverlos a un bucket; no está hecho en este MVP.

## Qué falta para producción

- Dominio, TLS y `APP_URL` definitivo.
- Textos legales revisados: condiciones de uso, privacidad, y el aviso de que South Wind no es un banco.
- Domicilio registrado en Montana, en lugar del marcador de posición.
- Tarifa comercial real (hoy la comisión es un marcador, por defecto 0,50 %, editable en el panel).
- Requisitos de la UIF y del PSAV para la pata en bolivianos. Esa conversión sigue siendo manual: este portal solo registra la solicitud, el estado y el comprobante.
- Clave, webhook y clientes del entorno de producción de Bridge, separados del sandbox.
- Correo de invitación, segundo factor, respaldos y una revisión de seguridad.
- Retención de comprobantes fuera del disco de la instancia.
- Quitar la marca de agua de demostración: desaparece sola cuando `BRIDGE_MOCK=false`.

## Notas de integración

- Encabezado de Bridge: `Api-Key`. En cada POST, `Idempotency-Key`. No se envía en GET.
- La comisión de South Wind viaja como `developer_fee` en `POST /transfers`. El origen del MVP es la billetera custodial (`bridge_wallet` / USDC) y el destino es la cuenta externa del beneficiario.
- La cuenta virtual de recepción liquida a USDC. El saldo que ve el cliente y el que arma el extracto es el libro interno del portal, actualizado al enviar, al acreditar un depósito y al marcar una conversión como pagada.
- Un pago devuelto o cancelado, avisado por webhook, revierte el cargo en el libro.

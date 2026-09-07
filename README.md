# OnlyTurn · NanoLabs

OnlyTurn es la plataforma SaaS multi-tenant de NanoLabs para gestionar turnos, citas, clases, eventos, reservas de recursos, profesionales, clientes y reglas comerciales desde un único motor universal.

Stack productivo: Next.js 16, React 19, TypeScript, Prisma, PostgreSQL, Docker, Cloudflare R2 y Mercado Pago.

## Arquitectura SaaS

### Plataforma NanoLabs

- `https://onlyturn.nanoapps.ar/superadmin/login` — login exclusivo de plataforma.
- `https://onlyturn.nanoapps.ar/superadmin` — dashboard global.
- `/superadmin/tenants` — alta y gestión de tenants.
- `/superadmin/tenants/[id]` — ficha, estado, plan y membresía.
- `/superadmin/planes` — planes SaaS editables.

### Tenant

Cada cliente opera exclusivamente bajo su hostname global NanoApps:

- `https://<slug>.nanoapps.ar/` — reserva pública.
- `https://<slug>.nanoapps.ar/login` — login administrativo del negocio.
- `https://<slug>.nanoapps.ar/dashboard` — panel administrativo.
- módulos tenant: agenda, clases/eventos, recurrencias, lista de espera, clientes/CRM, servicios, extras, paquetes/membresías, disponibilidad, políticas, automatizaciones, calendarios, reportes y configuración.
- `/suspendido` — servicio suspendido o membresía vencida.

Las rutas `/app/*` y `/r/[slug]/*` existen únicamente como implementación interna de Next.js. No son la URL normal de acceso de un cliente.

### Routing

`*.nanoapps.ar` pertenece al `nanoapps-router` central. El router consulta `/api/internal/caddy/ask?domain=...` de cada SaaS y entrega la petición al producto propietario del slug.

OnlyTurn conserva ownership de sus tenants aun cuando estén suspendidos o cancelados para evitar que otro SaaS capture el mismo slug y para poder mostrar `/suspendido`. Solo un tenant inexistente o archivado devuelve `404` al router.

La base PostgreSQL es compartida y todo dato operativo está aislado obligatoriamente por `tenantId`.

## Motor universal de reservas

OnlyTurn usa las mismas entidades para todos los rubros y evita forks por vertical:

- `APPOINTMENT` — turno/cita tradicional.
- `CLASS` — clase con sesión y cupo.
- `EVENT` — evento con ocurrencias y capacidad.
- `RESOURCE` — reserva de cancha, sala, equipo u otro activo.

Cada servicio puede definir profesionales y recursos como `NONE`, `OPTIONAL` o `REQUIRED`, múltiples asignaciones válidas, estrategia de elección del cliente, asignación automática o round-robin, preparación, duración, buffer, cupos y política comercial propia.

## Funcionalidad productiva

- onboarding del negocio;
- agenda diaria, semanal y mensual;
- alta manual y reserva pública mobile-first;
- citas, clases, eventos y reservas de recursos;
- sesiones con cupo real y asistentes;
- asignación automática y round-robin;
- recurrencias con series y ocurrencias vinculadas;
- reprogramación, check-in y estados de reserva;
- sucursales, servicios, profesionales y recursos;
- reglas y excepciones de disponibilidad;
- políticas por servicio: anticipación, cancelación, reprogramación, límites y confirmación;
- prevención de dobles reservas y protección de capacidad en PostgreSQL;
- lista de espera;
- extras que pueden sumar precio, duración y preparación;
- clientes, CRM y portal de cliente;
- registro/aprobación de cuentas de clientes;
- autogestión de cancelaciones según política;
- saldo, créditos y cuenta corriente;
- paquetes/pases/membresías por cantidad de usos, vigencia y servicios incluidos;
- consumo atómico de pases al reservar y devolución del uso ante cancelación o vencimiento de pago;
- branding por tenant, galería y anuncios;
- PWA pública;
- Mercado Pago para señas o pago total cuando corresponde;
- automatizaciones por eventos con cola idempotente e historial;
- email vía Resend y WhatsApp mediante adapter/webhook o Meta Graph cuando se configuran credenciales;
- worker interno Docker para procesar automatizaciones;
- feeds iCal privados globales y por profesional, compatibles con Google Calendar, Outlook y Apple Calendar;
- reportes operativos/comerciales y métricas de CRM;
- roles, permisos y auditoría;
- SuperAdmin NanoLabs;
- tenants, planes editables, membresías SaaS, vencimiento, renovación y suspensión.

## Ciclo de membresía SaaS

- alta inicial con trial;
- plan y período de membresía por tenant;
- vencimiento aplicado tanto a nuevos accesos como a sesiones existentes;
- suspensión automática al detectar una membresía vencida;
- dominio del tenant continúa resolviendo durante la suspensión;
- renovación desde SuperAdmin reactiva tenant y suscripción sin reprovisionar datos.

## Producción con Docker

1. Copiar `.env.example` a `.env` y completar secretos reales.
2. Mantener estables `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `AUTOMATION_CRON_SECRET` y `CALENDAR_FEED_SECRET`.
3. Configurar las credenciales iniciales del SuperAdmin NanoLabs si todavía no existe.
4. Ejecutar:

```bash
docker compose --env-file .env up -d --build
```

Flujo de arranque:

```text
PostgreSQL healthy
    ↓
migrate
    ├─ prisma migrate deploy
    └─ bootstrap de planes + SuperAdmin
    ↓
OnlyTurn app healthy
    ↓
automation-worker
```

El bootstrap es idempotente y **no crea tenants, clientes ni turnos demo**.

## Variables principales

Obligatorias en producción:

- `POSTGRES_PASSWORD`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `AUTOMATION_CRON_SECRET`
- `CALENDAR_FEED_SECRET`

Plataforma y routing:

- `PLATFORM_HOST=onlyturn.nanoapps.ar`
- `TENANT_BASE_DOMAIN=nanoapps.ar`
- `APP_BASE_URL=https://onlyturn.nanoapps.ar`
- `ONLYTURN_SUPERADMIN_EMAIL`
- `ONLYTURN_SUPERADMIN_PASSWORD`
- `ONLYTURN_SUPERADMIN_NAME`

Integraciones opcionales:

- email: `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`;
- WhatsApp adapter: `WHATSAPP_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_TOKEN`;
- WhatsApp Meta Graph: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`;
- pagos: `PAYMENT_ENCRYPTION_KEY`;
- R2: `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`.

## Validación

```bash
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run db:seed` sincroniza únicamente planes de plataforma. No crea datos demo.

Las capacidades futuras permanecen fuera de los planes hasta existir de punta a punta con schema, lógica tenant-safe, UI, permisos, auditoría y pruebas.

---

**OnlyTurn** es un producto de **NanoLabs**.

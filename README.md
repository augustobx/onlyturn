# OnlyTurn · NanoLabs

OnlyTurn es la plataforma SaaS multi-tenant de NanoLabs para gestionar turnos, citas, reservas, profesionales, recursos y clientes.

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
- `/agenda`, `/clientes`, `/servicios`, `/configuracion` — módulos del tenant.
- `/suspendido` — servicio suspendido o membresía vencida.

Las rutas `/app/*` y `/r/[slug]/*` existen únicamente como implementación interna de Next.js. No son la URL normal de acceso de un cliente.

### Routing

`*.nanoapps.ar` pertenece al `nanoapps-router` central. El router consulta `/api/internal/caddy/ask?domain=...` de cada SaaS y entrega la petición al producto propietario del slug.

OnlyTurn conserva ownership de sus tenants aun cuando estén suspendidos o cancelados para evitar que otro SaaS capture el mismo slug y para poder mostrar `/suspendido`. Solo un tenant inexistente o archivado devuelve `404` al router.

La base PostgreSQL es compartida y todo dato operativo está aislado obligatoriamente por `tenantId`.

## Ciclo de membresía

- alta inicial con trial;
- plan y período de membresía por tenant;
- vencimiento aplicado tanto a nuevos accesos como a sesiones existentes;
- suspensión automática al detectar una membresía vencida;
- dominio del tenant continúa resolviendo durante la suspensión;
- renovación desde SuperAdmin reactiva tenant y suscripción sin reprovisionar datos.

## Producción con Docker

1. Copiar `.env.example` a `.env` y completar secretos reales.
2. Mantener estable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
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
OnlyTurn app
```

El bootstrap es idempotente y **no crea tenants, clientes ni turnos demo**.

## Variables principales

Obligatorias en producción:

- `POSTGRES_PASSWORD`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Plataforma y routing:

- `PLATFORM_HOST=onlyturn.nanoapps.ar`
- `TENANT_BASE_DOMAIN=nanoapps.ar`
- `APP_BASE_URL=https://onlyturn.nanoapps.ar`
- `ONLYTURN_SUPERADMIN_EMAIL`
- `ONLYTURN_SUPERADMIN_PASSWORD`
- `ONLYTURN_SUPERADMIN_NAME`

Integraciones opcionales:

- `PAYMENT_ENCRYPTION_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_URL`

## Funcionalidad productiva

- onboarding del negocio;
- agenda diaria, semanal y mensual;
- alta manual y reserva pública;
- reprogramación y estados de turno;
- sucursales, servicios, profesionales y recursos;
- reglas y excepciones de disponibilidad;
- prevención de dobles reservas;
- clientes y portal de cliente;
- cuenta corriente;
- branding por tenant;
- galería y anuncios;
- PWA pública;
- Mercado Pago para señas o pago total cuando el plan lo habilita;
- roles, permisos y auditoría;
- SuperAdmin NanoLabs;
- tenants, planes editables, membresías, vencimiento, renovación y suspensión.

Las capacidades no implementadas end-to-end permanecen deshabilitadas hasta estar realmente listas para producción.

## Validación

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run db:seed` sincroniza únicamente planes de plataforma. No crea datos demo.

---

**OnlyTurn** es un producto de **NanoLabs**.

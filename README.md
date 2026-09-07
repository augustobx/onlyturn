# OnlyTurn · NanoLabs

OnlyTurn es la plataforma SaaS multi-tenant de NanoLabs para gestionar turnos, citas, reservas, profesionales, recursos y clientes desde una única aplicación.

El proyecto está preparado para producción con Next.js 16, React 19, TypeScript, Prisma, PostgreSQL, Docker, Cloudflare R2 y Mercado Pago.

## Arquitectura

- **Plataforma NanoLabs:** `/superadmin`
- **Panel del tenant:** `/app`
- **Reserva pública:** `/r/[slug]`
- **Dominio de plataforma:** `onlyturn.nanoapps.ar`
- **Dominio de tenant:** `<slug>.onlyturn.nanoapps.ar`
- **Base:** PostgreSQL compartido con aislamiento obligatorio por `tenantId`
- **Proxy:** red externa Docker `proxy`
- **Base de datos:** accesible únicamente por la red interna `onlyturn-internal`

OnlyTurn no debe resolver hosts genéricos `<slug>.nanoapps.ar`; cada tenant queda aislado dentro del namespace del producto.

## Producción con Docker

1. Copiar `.env.example` a `.env` y completar los secretos reales.
2. Configurar `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` con una clave estable de producción.
3. Configurar las credenciales iniciales del SuperAdmin NanoLabs si todavía no existe.
4. Ejecutar:

```bash
docker compose up -d --build
```

El flujo de arranque es:

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

Configuración de plataforma:

- `PLATFORM_HOST`
- `TENANT_BASE_DOMAIN`
- `APP_BASE_URL`
- `ONLYTURN_SUPERADMIN_EMAIL`
- `ONLYTURN_SUPERADMIN_PASSWORD`
- `ONLYTURN_SUPERADMIN_NAME`

Integraciones opcionales:

- `PAYMENT_ENCRYPTION_KEY` para Mercado Pago
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
- roles, permisos, auditoría, planes, límites y SuperAdmin.

Las capacidades no implementadas end-to-end permanecen deshabilitadas en los feature flags hasta estar realmente listas para producción.

## Desarrollo

Con PostgreSQL disponible y `DATABASE_URL` configurada:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

`npm run db:seed` sincroniza únicamente planes de plataforma. No crea datos demo.

## Validación

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentación

La documentación técnica se encuentra en `docs/` e incluye arquitectura, multi-tenancy, base de datos, reservas, seguridad, pagos, despliegue y backups.

---

**OnlyTurn** es un producto de **NanoLabs**.

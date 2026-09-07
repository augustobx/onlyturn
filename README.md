# OnlyTurn

Motor SaaS universal para turnos, citas, reservas, profesionales y recursos. El repositorio contiene un MVP vertical multi-tenant con panel operativo, reserva pública, SuperAdmin, planes, seed completo y protección de concurrencia en PostgreSQL.

## Inicio rápido

1. Copiar `.env.example` a `.env` y cambiar `SESSION_SECRET` y `POSTGRES_PASSWORD`.
2. Ejecutar `docker compose up -d --build`.
3. Esperar a que `docker compose ps` muestre `app` y `db` saludables.
4. Abrir [http://localhost:3000](http://localhost:3000).

El contenedor `migrate` aplica migraciones versionadas y ejecuta un seed idempotente antes de iniciar la aplicación. La base no se publica fuera de la red interna de Compose.

## Credenciales demo

| Acceso | Usuario | Contraseña |
|---|---|---|
| Tenant Centro Demo | `admin@onlyturn.demo` | `Demo1234!` |
| SuperAdmin Nano Labs | `superadmin@nanolabs.demo` | `Demo1234!` |
| Segundo tenant para aislamiento | `otro@onlyturn.demo` | `Demo1234!` |
| Cliente registrado Centro Demo | `mateo@demo.test` | `Demo1234!` |

Reserva pública: [http://localhost:3000/r/centro-demo](http://localhost:3000/r/centro-demo).

## Alcance implementado

- onboarding guiado para crear la primera sede, servicio, profesional o recurso y sus horarios;
- agenda con alta manual, reprogramación, estados, cancelación e historial auditado;
- catálogo operativo de sedes, servicios, profesionales y recursos;
- reserva pública con disponibilidad dinámica, campos personalizados y prevención de dobles reservas;
- configuración de marca, anticipación, ventana futura y bloqueos por negocio, sede, profesional o recurso;
- biblioteca de imágenes en Cloudflare R2, logo, portada/splash, galería y tablón de anuncios;
- PWA pública instalable con selección continua de fecha y hora;
- calendario administrativo diario, semanal y mensual con reprogramación mediante arrastre;
- señas o pago total por servicio mediante Mercado Pago Checkout Pro, con Secret Key/Access Token y Public Key cifradas, retorno y conciliación autoritativa;
- registro de clientes configurable, aprobación administrativa opcional, portal de perfil, historial y cuenta corriente;
- clientes aislados por tenant, roles y permisos, planes, límites y SuperAdmin.

Para habilitar las cargas se deben configurar `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL`. Los envíos reales de email/WhatsApp, pagos, lista de espera, recurrencia y portal de clientes quedan como extensiones posteriores al MVP.

## Desarrollo

Con PostgreSQL disponible y `DATABASE_URL` configurada:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Validación: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Base de datos](docs/database.md)
- [Multi-tenancy](docs/multitenancy.md)
- [Motor de reservas](docs/booking-engine.md)
- [Planes y suscripciones](docs/subscriptions.md)
- [Despliegue](docs/deployment.md)
- [Backups](docs/backups.md)
- [Seguridad](docs/security.md)
- [Pagos y Mercado Pago](docs/payments.md)
- [Revisión funcional de plataformas](docs/product-review.md)

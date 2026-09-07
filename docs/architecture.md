# Arquitectura

OnlyTurn usa un monolito modular con Next.js 16 App Router, React 19, TypeScript, Prisma y PostgreSQL. Esta forma reduce complejidad operativa, mantiene transacciones locales y permite escalar horizontalmente la aplicación detrás de un proxy.

## Planos

- **Plataforma:** `/superadmin`, planes, suscripciones, tenants, métricas globales y auditoría.
- **Tenant:** `/app`, onboarding, agenda, clientes, catálogo y configuración. Cada lectura pasa por sesión y `createTenantDb(tenantId)`.
- **Público:** `/r/[slug]`, catálogo público, disponibilidad y alta anónima de reservas.
- **Datos:** PostgreSQL compartido, con `tenantId` obligatorio en datos operativos e índices compuestos.

La UI no contiene reglas de negocio autoritativas. Server Actions y Route Handlers validan entrada, sesión, permiso, pertenencia y estado. La reserva pública recalcula disponibilidad y el precio proviene del servicio almacenado.

## Módulos

`src/lib/auth.ts` maneja sesiones; `tenant-db.ts` es la capa tenant-safe; `booking-service.ts` orquesta disponibilidad; `availability.ts` contiene el cálculo puro; `plans.ts` resuelve capacidades. Las páginas consumen DTOs acotados o repositorios cerrados. Las mutaciones de agenda, catálogo, configuración, onboarding y plataforma se validan en Server Actions y dejan auditoría donde corresponde.

## Evolución

La capa de notificaciones se representa por `NotificationLog` e idempotency key. Los proveedores de email/WhatsApp deben implementarse como adaptadores de un puerto común. El almacenamiento visual usa Cloudflare R2 y claves `tenants/{tenantId}/{tipo}/...`; PostgreSQL conserva metadatos y URLs, nunca el archivo. Pagos comerciales futuros deben mantenerse separados del cobro SaaS de `Subscription`.

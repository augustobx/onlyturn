# Base de datos

El esquema está en `prisma/schema.prisma`; las migraciones SQL son versionadas. PostgreSQL guarda todos los instantes en UTC (`timestamptz`) y el tenant define la zona usada para reglas y presentación.

## Núcleo

- `Tenant`, `User`, `Membership`, `Session` separan identidad, organización y roles.
- `Location`, `Professional`, `Resource`, `Service` forman un catálogo neutral al rubro.
- tablas puente determinan compatibilidad servicio-profesional-recurso-sucursal.
- `AvailabilityRule` guarda ventanas semanales; `AvailabilityException` bloqueos o aperturas puntuales.
- `Booking` conserva snapshot operativo de duración y precio; `BookingHistory` registra transiciones.
- `CustomField` y `CustomFieldValue` permiten formularios dinámicos sin alterar columnas.
- `Plan`, `Subscription` y `TenantFeatureOverride` forman el control comercial.

Los montos se guardan en centavos enteros. No se eliminan entidades con historia: se desactivan o archivan.

## Índices e integridad

Las consultas de agenda tienen índices por `(tenantId, startsAt)` y por asignación. Clientes deduplican teléfono con `(tenantId, normalizedPhone)`. PostgreSQL usa `btree_gist` y restricciones de exclusión sobre rangos `[inicio, fin)` para profesional y recurso. El campo explícito `consumesCapacity` gobierna el predicado inmutable; cancelaciones y ausencias lo desactivan sin borrar historial.

La versión actual considera recursos con capacidad 1 para exclusión estricta. La capacidad mayor a 1 queda modelada, pero necesita una transacción que cuente cupos bajo lock antes de habilitar reservas grupales.

# Multi-tenancy

El navegador nunca es autoridad para elegir un tenant administrativo. La sesión persistida contiene el tenant activo; el servidor vuelve a cargar membresía, estado del usuario y estado del tenant. En público, el slug/hostname resuelve únicamente tenants activos o en trial y solo se exponen campos publicados.

## Namespace de hosts

OnlyTurn utiliza un namespace exclusivo dentro de la infraestructura NanoLabs:

```text
onlyturn.nanoapps.ar
<slug>.onlyturn.nanoapps.ar
```

No se admite `<slug>.nanoapps.ar`. Esto evita colisiones con OnlyFood, OnlyMob, OnlyGym y otros productos que comparten `nanoapps.ar`.

La normalización y extracción de host vive en `src/lib/hostnames.ts`; `src/proxy.ts` solamente reescribe hosts válidos del producto.

Los dominios personalizados se consideran válidos únicamente cuando el registro `CustomDomain` está verificado. Hasta completar el flujo end-to-end de validación/DNS, la feature permanece deshabilitada en los planes productivos.

## Aislamiento de datos

`createTenantDb(tenantId)` ofrece operaciones cerradas. No devuelve el cliente Prisma y agrega `tenantId` internamente a las lecturas. En escrituras valida nuevamente sucursal, servicio, profesional y recurso dentro del mismo tenant, incluyendo relaciones anidadas.

El acceso global usa `platformDb` y se limita a servicios de plataforma, autenticación y a la implementación del repositorio tenant. SuperAdmin requiere una identidad `isSuperAdmin` independiente; un rol OWNER no concede acceso de plataforma.

## Validaciones obligatorias

- usar un ID real del tenant A desde una sesión B y esperar rechazo;
- intentar conectar servicio A con profesional B;
- comprobar que búsquedas por teléfono permiten el mismo valor en tenants distintos;
- verificar que SuperAdmin no obtiene implícitamente una membresía tenant;
- ejecutar dos inserts solapados y comprobar que PostgreSQL acepta solo uno;
- comprobar que `cliente.nanoapps.ar` no resuelve un tenant de OnlyTurn;
- comprobar que `cliente.onlyturn.nanoapps.ar` sí resuelve únicamente el tenant `cliente`.

# Multi-tenancy

El navegador nunca es autoridad para elegir un tenant administrativo. La sesión persistida contiene el tenant activo; el servidor vuelve a cargar membresía, estado del usuario y estado del tenant. En público, el slug/hostname resuelve únicamente tenants activos o en trial y solo se exponen campos publicados.

## Namespace de hosts

NanoLabs usa un namespace compartido para todos los SaaS:

```text
onlyturn.nanoapps.ar        -> plataforma / SuperAdmin de OnlyTurn
<slug>.nanoapps.ar          -> tenant, despachado por nanoapps-router
```

El wildcard `*.nanoapps.ar` llega al `nanoapps-router` central. El router consulta el endpoint `/api/internal/caddy/ask?domain=<hostname>` de cada SaaS y reenvía la petición al servicio que responde `204` indicando que ese hostname le pertenece.

OnlyTurn no decide qué SaaS recibe primero el hostname: únicamente valida si el slug solicitado existe en su propia base y está activo o en trial. Por eso el namespace de slugs debe mantenerse sin colisiones entre productos.

La normalización y extracción de host vive en `src/lib/hostnames.ts`; `src/proxy.ts` reescribe el hostname tenant válido a la experiencia pública correspondiente.

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
- comprobar que `cliente.nanoapps.ar` devuelve `204` en `/api/internal/caddy/ask` solo si `cliente` pertenece a OnlyTurn;
- comprobar que un slug inexistente devuelve `404` para que el router pueda probar el siguiente SaaS.

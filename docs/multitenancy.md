# Multi-tenancy

El navegador nunca es autoridad para elegir un tenant administrativo. La sesión persistida contiene el tenant activo; el servidor vuelve a cargar membresía, estado del usuario y estado del tenant. En público, el slug/hostname resuelve un tenant activo y solo se exponen campos publicados.

`createTenantDb(tenantId)` ofrece operaciones cerradas. No devuelve el cliente Prisma y agrega `tenantId` internamente a todas las lecturas. En escrituras valida de nuevo sucursal, servicio, profesional y recurso dentro del mismo tenant, incluyendo nested relations.

El acceso global usa `platformDb` y se limita a servicios de plataforma, autenticación y a la implementación del repositorio tenant. SuperAdmin requiere una identidad `isSuperAdmin` independiente; un rol OWNER no concede acceso de plataforma.

## Pruebas obligatorias

- usar un ID real del tenant A desde una sesión B y esperar rechazo;
- intentar conectar servicio A con profesional B;
- comprobar que búsquedas por teléfono permiten el mismo valor en tenants distintos;
- verificar que SuperAdmin no obtiene implícitamente una membresía tenant;
- ejecutar dos inserts solapados y comprobar que PostgreSQL acepta solo uno.

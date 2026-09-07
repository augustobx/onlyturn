# Multi-tenancy

OnlyTurn separa estrictamente el plano de plataforma NanoLabs del plano operativo de cada tenant.

## Hosts

```text
onlyturn.nanoapps.ar        -> plataforma / SuperAdmin
<slug>.nanoapps.ar          -> tenant, despachado por nanoapps-router
```

`*.nanoapps.ar` llega al `nanoapps-router` central. El router consulta `/api/internal/caddy/ask?domain=<hostname>` de cada SaaS y reenvía la petición al servicio que responde `204`.

OnlyTurn devuelve `204` para todo tenant propio no archivado, incluso si está suspendido o cancelado. De ese modo el dominio sigue perteneciendo a OnlyTurn y puede mostrar `/suspendido`. Un slug inexistente o archivado devuelve `404`.

## Experiencia tenant

La URL visible del cliente nunca depende de `/app` ni de `/r/[slug]`:

```text
https://<slug>.nanoapps.ar/               reserva pública
https://<slug>.nanoapps.ar/login          login administrativo
https://<slug>.nanoapps.ar/dashboard      dashboard tenant
https://<slug>.nanoapps.ar/agenda         agenda
https://<slug>.nanoapps.ar/clientes       clientes
https://<slug>.nanoapps.ar/servicios      servicios/equipo
https://<slug>.nanoapps.ar/configuracion  configuración
```

`src/proxy.ts` reescribe esas rutas canónicas hacia las rutas internas de Next.js. `/app/*` y `/r/[slug]/*` son detalles internos de implementación.

## Autenticación

El navegador no elige libremente el tenant administrativo. Para iniciar sesión:

1. el servidor resuelve el tenant desde `Host` / `X-Forwarded-Host`;
2. verifica la membresía SaaS y su vencimiento;
3. busca una membresía activa del usuario para ese tenant exacto;
4. crea una sesión vinculada al `tenantId` resuelto;
5. cada request administrativo vuelve a verificar que hostname, sesión y membresía correspondan al mismo tenant.

La cookie de sesión es host-only, por lo que una sesión iniciada en `cliente-a.nanoapps.ar` no se comparte automáticamente con `cliente-b.nanoapps.ar`.

El SuperAdmin usa una sesión separada con `tenantId=null` y sólo puede autenticarse en `onlyturn.nanoapps.ar/superadmin/login`.

## Membresía y suspensión

La última `Subscription` define el período de acceso. Un trial o membresía vencida se reconcilia a estado suspendido, bloqueando tanto sesiones nuevas como existentes. El tenant sigue resolviendo y muestra `/suspendido`. Una renovación desde SuperAdmin extiende el período y reactiva el mismo tenant sin reprovisionar datos.

## Aislamiento de datos

`createTenantDb(tenantId)` ofrece operaciones cerradas y agrega `tenantId` internamente a las lecturas/escrituras. El acceso global mediante `platformDb` queda reservado al plano de control, autenticación y resolución de tenants.

Un rol `OWNER` de tenant no concede privilegios de SuperAdmin.

## Validaciones obligatorias

- sesión de tenant A usada sobre hostname B: rechazo;
- owner de tenant A intentando acceder a datos B: rechazo;
- `cliente.nanoapps.ar` devuelve `204` en `ask` sólo si ese slug pertenece a OnlyTurn;
- tenant suspendido continúa devolviendo `204` en `ask` y muestra `/suspendido`;
- slug inexistente devuelve `404`;
- `onlyturn.nanoapps.ar` no funciona como panel administrativo de un tenant;
- el login de tenant vive en `slug.nanoapps.ar/login`;
- el login SuperAdmin vive en `onlyturn.nanoapps.ar/superadmin/login`.

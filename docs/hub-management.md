# Gestión central NanoLabs Hub

OnlyTurn mantiene el contrato de lectura `nanolabs.saas.tenants.v1` y agrega un
contrato separado `nanolabs.saas.management.v1` en
`/api/integrations/nanolabs/management`. El token de lectura no permite cambios.

Configurar exclusivamente en web `HUB_MANAGEMENT_ENABLED=true` y un
`HUB_MANAGEMENT_TOKEN` aleatorio de al menos 32 bytes, diferente del token de
lectura. No compartir con DB/migrador ni enviarlo al navegador. Opcionalmente
`HUB_MANAGEMENT_OPERATIONS` restringe operaciones mediante lista de nombres
separados por comas; una lista vacía prohíbe todas las escrituras.

Cada solicitud exige Bearer, administrador `X-NanoLabs-Actor`, timestamp Unix en
milisegundos `X-NanoLabs-Timestamp` (tolerancia cinco minutos) y
`X-NanoLabs-Signature` HMAC-SHA256 hexadecimal. Se firma la concatenación por
saltos de línea: timestamp, método, pathname+query exactos, actor y cuerpo exacto.
El Hub obtiene el actor desde su sesión, nunca del navegador.

GET admite `resource=catalog`, `plans`, `tenant&tenantId=...` y `audit`.
Planes y auditoría paginan con `offset` (100 por página). La ficha muestra hasta
100 administradores/pagos recientes; no exporta hashes, claves ni metadata de
auditoría sin filtrar. Ninguna lectura concilia membresías ni escribe estados.

POST requiere `requestId` UUID, `actor`, `operation` e `input` estricto. Operaciones:
tenant.create, tenant.update, tenant.status, subscription.update,
subscription.renew, module.set, admin.update, admin.revoke, plan.create,
plan.update y payment.record. No hay eliminación de tenants/planes ni SQL remoto.
Se valida pertenencia de cuentas, estados, períodos vigentes, importes enteros
en centavos ARS, módulos y límites conocidos. Activar no renueva automáticamente.

Las escrituras toman locks de fila y registran un recibo de auditoría en la
misma transacción. Repetir el mismo UUID y cuerpo devuelve el resultado original;
reutilizarlo con otro cuerpo devuelve 409. Los secretos no se guardan en el
recibo: se usa un fingerprint HMAC. Una versión desactualizada devuelve 409.
Referencias de pago repetidas también se rechazan. Un fallo de auditoría revierte
la operación completa. No se necesitan migraciones de esquema.

Los módulos y límites efectivos usan el plan y las excepciones de TenantFeatureOverride.
Los pagos SaaS se registran en la auditoría de plataforma, como en el Superadmin
nativo; no se mezclan con transacciones de clientes.
Cambiar credenciales revoca sesiones y rechaza cuentas compartidas para evitar
alterar identidades de otros tenants. No se implementa impersonación mediante
contraseñas, enlaces universales o acceso anónimo.

Despliegue: build solo del target runner; excluir `.env*`; respaldar y verificar
PostgreSQL, guardar imagen rollback, luego `up -d --no-deps --no-build app`.
Nunca arrancar migradores. Para deshabilitar escrituras basta quitar la bandera
de gestión y recrear solo web. Rollback de imagen no deshace acciones comerciales;
corregirlas mediante una operación administrativa inversa y auditada.

Pruebas mutativas únicamente contra PostgreSQL aislado con esquema y datos
sintéticos; comprobar idempotencia, concurrencia, límites, auditoría, propiedad,
accesos y ausencia de secretos antes de producción. En producción usar smoke
de lectura y rechazo de solicitudes inválidas; no crear clientes de prueba.


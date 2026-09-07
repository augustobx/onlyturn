# Despliegue productivo

OnlyTurn se despliega en la infraestructura NanoLabs como una única instancia SaaS multi-tenant.

Ruta estándar del servidor:

```text
/opt/apps/onlyturn
```

Topología:

```text
Internet
  ↓
Nginx Proxy Manager
  ├─ onlyturn.nanoapps.ar -> onlyturn-web:3000
  └─ *.nanoapps.ar -> nanoapps-router:8080
                        ↓ consulta ownership
                  onlyturn-web:3000
                        ↓ red onlyturn-internal
                  onlyturn-db:5432
```

PostgreSQL nunca publica un puerto al host.

## Dominios

- plataforma / SuperAdmin: `onlyturn.nanoapps.ar`
- tenants: `<slug>.nanoapps.ar`

El wildcard `*.nanoapps.ar` pertenece al `nanoapps-router` central, no directamente a OnlyTurn. El router conserva `Host` / `X-Forwarded-Host`, consulta `/api/internal/caddy/ask?domain=<hostname>` y envía la petición al SaaS que declara ownership del slug.

OnlyTurn debe devolver `204` únicamente para tenants activos o en trial que existan en su propia base, y `404` para hostnames que no le pertenecen.

## Deploy

```bash
cd /opt/apps/onlyturn
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 app migrate
```

El flujo es:

1. PostgreSQL inicia y queda healthy.
2. `migrate` ejecuta `prisma migrate deploy`.
3. El bootstrap sincroniza planes y, si se proporcionan credenciales, el SuperAdmin NanoLabs.
4. La aplicación inicia solamente si DB y migraciones terminaron correctamente.
5. `/api/health` valida proceso + acceso a PostgreSQL.

No se ejecuta ningún seed de tenants demo durante el deploy.

## Variables críticas

El Compose falla de forma explícita si falta:

- `POSTGRES_PASSWORD`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` debe ser estable entre rebuilds. Generar una clave AES válida de 32 bytes codificada en Base64 y conservarla como secreto productivo.

`PAYMENT_ENCRYPTION_KEY` es obligatoria antes de habilitar Mercado Pago y debe tener al menos 32 caracteres.

## Cloudflare R2

Crear un bucket exclusivo de OnlyTurn, dominio público de lectura y token limitado al bucket. Configurar las variables `R2_*` documentadas en `.env.example`. No utilizar credenciales globales de Cloudflare.

## Validación después de deploy

Como mínimo:

- contenedores healthy;
- `/api/health` en estado `ok`;
- login SuperAdmin por `onlyturn.nanoapps.ar`;
- login tenant cuando exista uno;
- alta de tenant desde SuperAdmin;
- `/api/internal/caddy/ask?domain=<slug>.nanoapps.ar` responde `204` para un tenant OnlyTurn real;
- el mismo endpoint responde `404` para un slug que no pertenece a OnlyTurn;
- reserva pública por `<slug>.nanoapps.ar` a través de `nanoapps-router`.

Cuando existan clientes reales, incorporar el backup de PostgreSQL a la política central de backups de NanoLabs antes de cada cambio de schema con riesgo.

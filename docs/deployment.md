# Despliegue

El Compose local levanta PostgreSQL, un inicializador one-shot y la aplicación. La imagen usa Node 22, build multi-stage, salida standalone y usuario no-root. App y base tienen healthchecks, políticas de reinicio y rotación de logs; PostgreSQL solo existe en la red interna.

```bash
cd /ruta/absoluta/onlyturn
docker compose --env-file .env -p onlyturn up -d --build
docker compose --env-file .env -p onlyturn ps
docker compose --env-file .env -p onlyturn logs --tail=100 app migrate
```

En producción se requiere HTTPS, proxy existente, DNS wildcard, secretos únicos, bucket Cloudflare R2, monitoreo y backups. No se deben publicar 80/443 ni el puerto de PostgreSQL sin inventariar el host. El proxy debe enviar el hostname original y conectarse al puerto interno acordado.

## Cloudflare R2

Crear un bucket para OnlyTurn, habilitar un dominio público de lectura y generar un token limitado a lectura/escritura de objetos en ese bucket. Configurar las cinco variables `R2_*` documentadas en `.env.example`. No usar claves globales de la cuenta de Cloudflare.

`/api/health` confirma proceso y base. Un despliegue solo queda validado después de login tenant, SuperAdmin, reserva pública, cancelación, aislamiento y restauración de backup en entorno separado.

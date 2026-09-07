# Backups y restore

Un backup válido incluye PostgreSQL, objetos del bucket y la clave maestra de cifrado futura. La clave se guarda en un gestor de secretos separado.

Ejemplo de dump en caliente desde Compose:

```bash
docker compose -p onlyturn exec -T db pg_dump -U onlyturn -d onlyturn -Fc > backups/onlyturn-$(date +%Y%m%d-%H%M).dump
```

Copiar el archivo cifrado fuera del host. Política sugerida: diarios por 14 días, semanales por 8 semanas y mensuales por 12 meses. Habilitar PITR con WAL cuando el volumen comercial lo justifique.

Para restaurar, crear una base aislada, usar `pg_restore --clean --if-exists`, apuntar una instancia temporal, correr health y smoke tests y medir RPO/RTO. Nunca probar restauración sobre producción ni usar `docker compose down -v` como rutina.

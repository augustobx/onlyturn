---
name: production-server
description: >-
  Access, manage, and deploy to the production server for OnlyTurn and related NanoApps.
  Includes SSH connection parameters, strict container isolation rules, safety boundaries, and approved commands.
  Use whenever interacting with or deploying to the remote production server.
---

# Servidor de Producción · Guía de Acceso y Operación Segura

Este skill documenta el acceso por SSH al servidor de producción de **NanoApps / OnlyTurn** y establece las **reglas críticas e innegociables de seguridad** para operar en él.

---

## ⚠️ REGLAS FUNDAMENTALES DE SEGURIDAD (MISIÓN CRÍTICA - PRODUCCIÓN)

> [!CAUTION]
> **ENTORNO DE PRODUCCIÓN COMPARTIDO Y VIVO**
> En este servidor corren múltiples negocios y servicios activos en paralelo (`onlyerp`, `onlycars`, `onlyfood`, `onlygym`, `onlypadel`, `onlymob`, `nanokeys`, `nanolabs`, etc.). Dejar un servicio ajeno offline es un **error crítico inaceptable**.

1. **PROHIBIDO TOCAR CONTENEDORES AJENOS:**
   * NUNCA ejecutar comandos que afecten contenedores fuera del proyecto objetivo (`onlyturn`).
   * **PROHIBIDO** usar comodines o comandos destructivos masivos como:
     - ❌ `docker stop $(docker ps -aq)`
     - ❌ `docker rm -f $(docker ps -aq)`
     - ❌ `docker system prune -a` (podría borrar imágenes o volúmenes de otros servicios)
     - ❌ `docker kill ...` en cualquier contenedor ajeno
2. **PROHIBIDO ALTERAR EL PROXY O LA RED DEL HOST:**
   * NUNCA modificar ni reiniciar `nginx-proxy-manager` ni `nanoapps-router`.
   * NUNCA modificar el firewall (`ufw`, `iptables`), interfaces de red del host ni configuración DNS/Caddy.
3. **ÁMBITO EXCLUSIVO DE ONLYTURN:**
   * Directorio del proyecto: `/opt/apps/onlyturn`
   * Contenedores autorizados:
     - `onlyturn-web` (servicio `app` en docker-compose)
     - `onlyturn-automation-worker` (servicio `automation-worker` en docker-compose)
     - `onlyturn-db` (servicio `db` en docker-compose)
   * Cualquier comando de Docker Compose debe ejecutarse **exclusivamente dentro de `/opt/apps/onlyturn`** y especificando el servicio concreto (ej. `docker compose up -d --build app`).
4. **VERIFICACIÓN OBLIGATORIA PRE Y POST EJECUCIÓN:**
   * Antes y después de cualquier intervención, correr `docker ps --filter "name=onlyturn"` para comprobar la salud de los contenedores propios sin alterar los demás.

---

## Parámetros de Conexión SSH

* **Host:** `149.50.159.163`
* **Puerto:** `2207`
* **Usuario:** `augusto`
* **Autenticación SSH Key:**
  - Clave pública vinculada en `~/.ssh/authorized_keys` del servidor.
  - Clave privada local: `~/.ssh/id_ed25519`
  - Alias configurado en `~/.ssh/config`: `onlyturn-prod`
* **Comando directo:**
  ```bash
  ssh onlyturn-prod
  # o
  ssh -p 2207 augusto@149.50.159.163
  ```

---

## Procedimiento de Despliegue Seguro para OnlyTurn

Cuando se requiera actualizar y desplegar cambios en producción:

1. **Conectarse y verificar estado previo:**
   ```bash
   ssh onlyturn-prod "docker ps --filter 'name=onlyturn'"
   ```
2. **Actualizar el repositorio en `/opt/apps/onlyturn`:**
   ```bash
   ssh onlyturn-prod "cd /opt/apps/onlyturn && git pull origin main"
   ```
3. **Reconstruir y reiniciar ÚNICAMENTE el contenedor de la aplicación:**
   ```bash
   ssh onlyturn-prod "cd /opt/apps/onlyturn && docker compose up -d --build app"
   ```
4. **Verificar logs del contenedor:**
   ```bash
   ssh onlyturn-prod "docker logs --tail 30 onlyturn-web"
   ```
5. **Comprobar que todos los demás servicios continúan intactos:**
   ```bash
   ssh onlyturn-prod "docker ps"
   ```

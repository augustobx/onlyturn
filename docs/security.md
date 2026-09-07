# Seguridad

- Argon2id para contraseñas y tokens de sesión aleatorios almacenados solo como SHA-256.
- Cookies HttpOnly, SameSite=Lax y Secure bajo HTTPS; sesiones expirables y revocables.
- RBAC evaluado en Server Actions; datos consultados mediante DAL tenant-safe.
- Zod valida entradas; precios, estados y disponibilidad se recalculan en servidor.
- IDs de relaciones se vuelven a validar contra el tenant para reducir IDOR.
- restricciones PostgreSQL evitan doble booking aun con dos instancias de aplicación.
- headers `nosniff`, `DENY`, Referrer Policy y Permissions Policy.
- secretos solo por entorno; base no publicada; contenedor no-root.

Antes de producción faltan un rate limiter compartido (Redis o perímetro), CSP ajustada, recuperación de contraseña por token, MFA para SuperAdmin, cifrado de credenciales por tenant, integración real de observabilidad y escaneo automatizado de dependencias. Los logs no deben contener contraseñas, cookies, tokens ni payloads clínicos completos.

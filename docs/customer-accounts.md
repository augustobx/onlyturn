# Cuentas de clientes

Cada cuenta pertenece a un único tenant y se vincula uno a uno con su ficha `Customer`. Las sesiones públicas usan una cookie independiente de las sesiones administrativas y no pueden reutilizarse entre negocios.

## Configuración

En **Configuración → Clientes** el negocio puede:

- habilitar o deshabilitar el registro público;
- exigir o no aprobación administrativa.

Si la aprobación está activa, el registro nace `PENDING`. Un administrador puede aprobarlo, rechazarlo o suspender una cuenta desde **Clientes → Ver ficha**. Rechazar o suspender revoca todas las sesiones del cliente.

## Portal público

- `/r/SLUG/cuenta`: ingreso;
- `/r/SLUG/registro`: alta pública cuando está habilitada;
- `/r/SLUG/mi-cuenta`: perfil, historial de turnos y cuenta corriente.

Las contraseñas usan Argon2id. Los tokens de sesión son aleatorios y solo se almacenan mediante SHA-256. El cliente solo ve reservas y movimientos de su propia ficha.

## Cuenta corriente

Los movimientos son inmutables y guardan importe en centavos, tipo, concepto, fecha y administrador creador. Un cargo aumenta el saldo adeudado; pagos y créditos lo reducen. Los ajustes aceptan signo positivo o negativo. El saldo se calcula como la suma de los movimientos y no reemplaza la conciliación de Mercado Pago.

La recuperación de contraseña y la verificación de email quedan fuera de este módulo inicial y deben agregarse antes de abrir registro anónimo en producción.

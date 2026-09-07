# Planes y suscripciones

Cada plan almacena un documento de capacidades: límites y flags. `effectiveFeatures` toma el plan de la suscripción activa y aplica overrides del tenant; una excepción explícita gana sobre el plan. Los componentes no hardcodean límites.

Los límites actuales cubren sucursales, profesionales, recursos y reservas mensuales, más WhatsApp, reportes avanzados, dominio propio, lista de espera, señas y recurrencia. La validación vive en backend.

El cobro de OnlyTurn pertenece a la plataforma y se modela en `Subscription`. Los pagos o señas de una reserva pertenecen al tenant y usan campos de estado separados. Una futura integración debe tener proveedores y webhooks distintos, firma verificada e idempotencia.

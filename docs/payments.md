# Pagos y señas con Mercado Pago

OnlyTurn integra Checkout Pro mediante la Preferences API. Las credenciales pertenecen a cada tenant y se cifran con AES-256-GCM usando `PAYMENT_ENCRYPTION_KEY`; nunca se exponen al navegador ni se comparten entre negocios.

## Flujo

1. El tenant conecta Secret Key/Access Token y Public Key desde Configuración → Pagos, igual que en OnlyFood.
2. Cada servicio define `NONE`, `DEPOSIT` o `FULL`, porcentaje y minutos de retención.
3. Una reserva con cobro nace `PENDING`, conserva capacidad y genera una preferencia idempotente.
4. El cliente paga en Checkout Pro y vuelve a una URL pública de resultado.
5. Tanto el webhook como el retorno consultan el pago directamente en Mercado Pago. La reserva solo cambia a `CONFIRMED/PAID` después de validar la respuesta autoritativa, el tenant, la referencia externa, el importe y la moneda.
6. Una retención vencida se libera antes del siguiente cálculo de disponibilidad.

La URL configurada en Mercado Pago debe ser `https://DOMINIO/api/webhooks/mercadopago/CONNECTION_ID`, usar el evento Pagos y tener HTTPS público. No se pide un secreto de webhook al comercio. Los parámetros del navegador nunca se consideran prueba de pago: solo disparan una consulta autenticada con el Access Token.

Referencias: [crear preferencia](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/preferences/create-preference/post), [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications) y [URLs de retorno](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/configure-back-urls).

## Producción

- usar credenciales productivas del comercio correspondiente;
- rotar `PAYMENT_ENCRYPTION_KEY` mediante una migración de recifrado, nunca cambiándola directamente;
- simular el webhook desde Tus integraciones antes de aceptar cobros;
- conciliar importes, moneda, referencia externa y payment ID;
- configurar alertas para webhooks fallidos y reservas pendientes vencidas.

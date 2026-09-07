# Motor de disponibilidad y reservas

Los slots no se persisten. Para una fecha se cargan reglas semanales relevantes y se intersectan ventanas del tenant, sucursal, profesional y recurso. Luego se restan reservas activas y excepciones globales o específicas; se aplican preparación, duración, buffer, intervalo, anticipación mínima y ventana máxima futura.

Todos los instantes se convierten desde la zona IANA del tenant a UTC antes de consultar o escribir. La respuesta vuelve como ISO UTC y la UI la muestra en la zona del negocio.

## Confirmación

1. resolver tenant público activo;
2. validar plan y catálogo dentro de ese tenant;
3. recalcular el slot solicitado;
4. deduplicar cliente por teléfono dentro del tenant;
5. crear reserva e historial en transacción serializable;
6. dejar que las restricciones de exclusión de PostgreSQL resuelvan carreras finales.

Los campos personalizados activos se validan contra el servicio elegido y sus valores se guardan en la misma transacción que la reserva. Así no pueden enviarse campos pertenecientes a otro tenant o servicio, ni quedar respuestas huérfanas.

El turno conserva `startsAt/endsAt` para la atención visible y `capacityStartsAt/capacityEndsAt` para preparación y buffer. Las restricciones trabajan sobre el segundo rango. El estado es enum en el MVP y el historial evita perder transiciones. Para estados configurables en V2 se recomienda una tabla `BookingStatusDefinition` con categorías semánticas estables (`active`, `capacity_consuming`, `final`).

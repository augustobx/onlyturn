# Revisión funcional de plataformas de reservas

Revisión realizada en agosto de 2026 sobre documentación oficial.

## Funciones incorporadas

- **Pago dentro de la reserva:** Calendly presenta el cobro integrado como forma de reducir ausencias y evitar facturación separada. OnlyTurn incorpora seña o pago total por servicio con Mercado Pago. [Calendly Payments](https://calendly.com/payments)
- **Políticas visibles y retención:** el cliente ve el importe antes de salir al checkout; el horario se retiene durante un plazo explícito y luego se libera.
- **Formulario progresivo:** la reserva guía al cliente hacia la asignación, horario y datos sin recargar pantallas.
- **Campos para preparar y enrutar:** los campos dinámicos ya permiten recopilar información previa; la evolución natural es agregar reglas de asignación según respuestas. [Calendly Routing](https://calendly.com/scheduling/routing)
- **Automatización antes y después:** recordatorios, reconfirmación, seguimiento y recuperación de no-shows son el siguiente bloque de alto impacto. [Calendly Workflows](https://calendly.com/help/automations-overview)
- **Analítica operativa:** días/horarios más demandados, cumplimiento y profesionales más ocupados deben derivarse de eventos y estados existentes. [Calendly Features](https://calendly.com/features)

## Recomendado después del MVP

1. recordatorios y reconfirmación por email/WhatsApp;
2. enlaces de pago independientes para saldos o servicios adicionales;
3. paquetes de sesiones y membresías;
4. reglas de cancelación con devolución automática;
5. asignación round-robin y límites diarios por profesional;
6. sincronización bidireccional con Google/Outlook Calendar;
7. encuestas posteriores, solicitud de reseña y recuperación de no-show.

Estas funciones deben habilitarse mediante capacidades del plan y providers desacoplados, no como condiciones específicas dentro de la UI.

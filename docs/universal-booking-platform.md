# OnlyTurn · Plataforma universal de reservas

## Objetivo de producto

OnlyTurn no debe ser un sistema para un rubro concreto. El núcleo debe modelar **tiempo + capacidad + personas + recursos + clientes + reglas comerciales**, y cada negocio debe poder activar únicamente las capacidades que necesita.

El estándar de producto se apoya en patrones presentes en plataformas líderes:

- **Calendly:** routing, round-robin, scheduling colectivo y automatizaciones.
- **SimplyBook.me:** núcleo simple con capacidades activables, clases/eventos, membresías, paquetes, add-ons, lista de espera, formularios, múltiples ubicaciones y recursos.
- **Fresha:** recursos incluso sin personal, formularios previos, waitlist inteligente, citas grupales, staffing y operación comercial.
- **Square Appointments:** clases recurrentes, cupos, recursos, políticas de cancelación/no-show, prep/processing time y pagos.
- **Acuity Scheduling:** intake forms, paquetes, suscripciones, certificados, add-ons, políticas y calendarios múltiples.
- **Vagaro / Booksy / Mindbody:** perfiles de cliente, membresías, paquetes, fidelización, permisos de staff, comisiones, inventario/POS y documentación vertical opcional.

Referencias oficiales consultadas:

- https://help.simplybook.me/wiki/Custom_Features/en
- https://help.simplybook.me/wiki/Custom_Features_by_category
- https://simplybook.me/classes-page
- https://www.fresha.com/es/for-business/features/scheduling
- https://www.fresha.com/help-center/knowledge-base/calendar/259-set-up-and-manage-your-waitlist
- https://www.fresha.com/help-center/knowledge-base/calendar/262-create-and-manage-group-appointments
- https://squareup.com/help/us/en/article/7065-square-appointments-resource-management
- https://squareup.com/help/us/en/article/7991-class-booking-with-square-appointments
- https://squareup.com/us/en/appointments/features/cancellation-policy

## Principio arquitectónico

No crear `if (rubro === "PELUQUERIA")`, `if (rubro === "MEDICO")`, etc.

El tenant selecciona una **plantilla de onboarding** que configura nombres, defaults y módulos; después todo funciona con las mismas entidades del motor.

Ejemplos:

| Rubro | Tipo de reserva | Persona | Recurso | Cupo | Formulario | Pago |
| --- | --- | --- | --- | ---: | --- | --- |
| Consultorio | Cita | Médico | Consultorio | 1 | Historia previa | Opcional |
| Peluquería | Cita | Estilista | Sillón | 1 | Preferencias | Seña |
| Canchas | Recurso | Opcional | Cancha | 1 reserva | Jugadores | Seña/total |
| Yoga | Clase | Instructor | Sala | 20 | Salud | Pase/membresía |
| Taller mecánico | Cita | Mecánico | Elevador | 1 | Vehículo | Opcional |
| Coworking | Recurso | Ninguno | Sala/escritorio | N | Empresa | Pago |
| Academia | Clase/evento | Docente | Aula | N | Alumno | Paquete/membresía |
| Fotografía | Cita | Fotógrafo | Estudio/equipo | 1 | Brief | Seña |

## Núcleo obligatorio

### 1. Tipos de reserva

El servicio debe evolucionar a un `BookingType` configurable:

- `APPOINTMENT`: cita 1:1 o servicio tradicional.
- `CLASS`: sesión con cupos y varios asistentes independientes.
- `EVENT`: fecha/evento puntual o serie de fechas.
- `RESOURCE`: reserva de sala, cancha, vehículo, equipo o activo sin necesidad de staff.

La UI puede llamarlo “Tipo de reserva”; internamente sigue siendo una entidad tenant-scoped.

### 2. Estrategias de asignación

- cliente elige profesional;
- cualquiera disponible;
- round-robin;
- prioridad/peso;
- menor carga;
- asignación manual;
- colectiva: varios profesionales requeridos en la misma reserva;
- recurso automático disponible.

### 3. Capacidad real

Separar dos conceptos:

- **capacidad del recurso**: cuántas personas/admisiones soporta una sala o activo;
- **cupos de una sesión**: cuántas reservas pueden ocupar el mismo horario.

Para clases/eventos no alcanza con múltiples `Booking` solapados: debe existir una `Session`/`Occurrence` con capacidad y asistentes asociados. Esto preserva la exclusión de doble-booking para profesionales y recursos.

### 4. Reglas comerciales por servicio

Cada tipo de reserva puede definir:

- anticipación mínima y máxima;
- ventana de cancelación/reprogramación;
- confirmación automática o aprobación manual;
- precio fijo / consultar / desde;
- seña, pago total o sin pago;
- política de no-show;
- preparación previa;
- processing time / tiempo liberado;
- buffer posterior;
- límite diario/semanal por cliente;
- nuevos clientes vs clientes existentes;
- edad mínima/máxima cuando corresponda;
- cantidad mínima/máxima de asistentes;
- términos que el cliente debe aceptar.

### 5. Clientes / CRM de reservas

Mantener una única ficha por tenant con:

- datos principales y tags;
- historial de turnos;
- no-shows/cancelaciones;
- saldo/cuenta corriente;
- formularios y datos personalizados;
- archivos/consentimientos futuros;
- paquetes, pases y membresías;
- preferencias y profesional habitual;
- valor/recurrencia del cliente;
- comunicaciones y consentimientos.

### 6. Lista de espera

Debe permitir:

- servicio, sede y rango de fechas/horas deseado;
- profesional/recurso opcional;
- prioridad y orden de ingreso;
- oferta automática de un hueco liberado;
- expiración de la oferta;
- estrategia “primero que reserva” o asignación dirigida;
- trazabilidad de ofertas y conversiones.

### 7. Recurrencias

Soportar series mediante reglas RRULE o equivalente:

- semanal/quincenal/mensual;
- N ocurrencias o hasta fecha;
- reservar sólo si todas entran o aceptar parciales;
- editar una ocurrencia / futuras / toda la serie;
- cancelación individual sin destruir la serie.

### 8. Add-ons, paquetes y membresías

- add-ons que suman precio, duración o preparación;
- múltiples servicios en un checkout;
- paquetes de N sesiones;
- bonos/créditos;
- membresías recurrentes;
- servicios exclusivos para miembros;
- vencimiento y consumo trazable;
- gift cards/cupones en una etapa posterior.

### 9. Automatizaciones

Motor por eventos, desacoplado de proveedores:

Eventos sugeridos:

- `booking.created`
- `booking.confirmed`
- `booking.rescheduled`
- `booking.cancelled`
- `booking.no_show`
- `booking.completed`
- `payment.pending`
- `payment.paid`
- `waitlist.slot_opened`
- `membership.expiring`

Acciones:

- email;
- WhatsApp;
- push;
- webhook;
- tarea interna;
- solicitud de reseña;
- mensaje post-servicio;
- recuperación de no-show.

### 10. Calendarios externos

Provider abstraction para Google/Outlook:

- importar busy blocks;
- exportar reservas;
- sincronización bidireccional con idempotencia;
- calendario por profesional;
- timezone segura;
- evitar que un evento personal genere doble reserva.

## Módulos opcionales por vertical

Estos módulos deben ser activables y nunca contaminar el core:

- notas clínicas/SOAP y consentimientos;
- ficha de mascota;
- ficha de vehículo;
- ficha de equipo/activo;
- inventario y productos;
- POS;
- comisiones;
- tickets/QR/check-in;
- teleconsulta/video;
- formularios con carga de archivos;
- documentos y firmas;
- loyalty/puntos;
- campañas y marketing.

## UX requerida

### Administrador del tenant

Navegación objetivo:

1. Resumen
2. Agenda
3. Reservas
4. Clientes
5. Servicios
6. Equipo
7. Recursos
8. Clases / Eventos (visible sólo si se activa)
9. Lista de espera (visible sólo si se activa)
10. Ventas / Membresías (visible sólo si se activa)
11. Automatizaciones
12. Reportes
13. Configuración

### Cliente final

El flujo debe ser mobile-first:

1. sede o modalidad;
2. servicio/clase/recurso;
3. asignación si aplica;
4. fecha y horario/sesión;
5. add-ons si aplica;
6. datos/formularios;
7. política y consentimiento;
8. pago si aplica;
9. confirmación + gestión desde `Mi cuenta`.

Si no hay disponibilidad: mostrar lista de espera cuando esté habilitada.

## Analítica profesional

Métricas mínimas:

- reservas creadas/confirmadas/completadas;
- cancelación y no-show rate;
- ocupación por profesional/recurso/sede;
- horas pico;
- servicios más reservados;
- conversión de waitlist;
- anticipación promedio de reserva;
- revenue reservado/cobrado/pendiente;
- ticket promedio;
- clientes nuevos vs recurrentes;
- retención 30/60/90 días;
- utilización de capacidad en clases;
- rendimiento de automatizaciones.

## Prioridad de implementación

### Fase A · Universalización inmediata

- exponer categoría, duración, preparación, buffer, precio, color;
- modos `NONE/OPTIONAL/REQUIRED` para profesional y recurso;
- múltiples profesionales/recursos habilitados;
- edición/archivo de servicio;
- mejorar catálogo y terminología neutral por rubro.

### Fase B · Motor de sesiones y capacidad

- `BookingType`;
- `Session/Occurrence` para clases y eventos;
- asistentes/cupos;
- resource-only real;
- recurrencia de sesiones;
- check-in de asistentes.

### Fase C · Conversión y protección de agenda

- waitlist;
- políticas por servicio;
- aprobación manual;
- no-show protection;
- reprogramación/cancelación self-service robusta;
- add-ons.

### Fase D · Revenue recurrente

- paquetes;
- membresías de clientes;
- créditos/pases;
- cupones/gift cards;
- multi-service checkout.

### Fase E · Automatización e integraciones

- workflow engine;
- WhatsApp/email/push productivo;
- Google/Outlook Calendar;
- webhooks/API pública;
- reseñas y campañas.

### Fase F · Vertical packs

Templates de onboarding y módulos opcionales, sin forks del producto.

## Regla de release

Una capacidad sólo se habilita en planes cuando el flujo está completo de punta a punta: schema, lógica tenant-safe, UI admin, UI pública cuando aplique, permisos, auditoría, tests y comportamiento de suspensión/membresía. Flags de funciones futuras permanecen apagados.

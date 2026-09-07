"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPublicBookingAction } from "@/app/actions/public-booking";
import { WaitlistForm } from "./waitlist-form";

type Location = { id: string; name: string; address: string | null };
type CustomField = {
  id: string;
  label: string;
  type: "TEXT" | "NUMBER" | "PHONE" | "EMAIL" | "DATE" | "SELECT" | "MULTI_SELECT" | "CHECKBOX" | "TEXTAREA";
  required: boolean;
  options: unknown;
};
type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  bookingType: "APPOINTMENT" | "CLASS" | "EVENT" | "RESOURCE";
  assignmentStrategy: "CLIENT_CHOOSES" | "ANY_AVAILABLE" | "ROUND_ROBIN" | "MANUAL";
  durationMinutes: number;
  preparationMinutes: number;
  bufferMinutes: number;
  minPartySize: number;
  maxPartySize: number;
  allowWaitlist: boolean;
  allowRecurring: boolean;
  priceCents: number | null;
  color: string;
  professionalMode: string;
  resourceMode: string;
  depositPolicy: unknown;
  locations: { locationId: string }[];
  professionals: { professional: { id: string; name: string } }[];
  resources: { resource: { id: string; name: string; type: string | null } }[];
  customFields: CustomField[];
};
type SessionOption = {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  occupied: number;
  available: number;
  professional: { id: string; name: string } | null;
  resource: { id: string; name: string; type: string | null } | null;
};

const bookingTypeLabel: Record<Service["bookingType"], string> = {
  APPOINTMENT: "Turno",
  CLASS: "Clase",
  EVENT: "Evento",
  RESOURCE: "Reserva",
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const addUtcDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return isoDate(value);
};

export function BookingWizard({
  slug,
  currency,
  timezone,
  cancellationHours,
  locations,
  services,
  customer,
}: {
  slug: string;
  currency: string;
  timezone: string;
  cancellationHours: number;
  locations: Location[];
  services: Service[];
  customer?: { firstName: string; lastName: string; phone: string; email: string };
}) {
  const [locationId, setLocation] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessional] = useState("");
  const [resourceId, setResource] = useState("");
  const [date, setDate] = useState(() => isoDate(new Date(Date.now() + 86_400_000)));
  const [weekStart, setWeekStart] = useState(() => isoDate(new Date()));
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [partySize, setPartySize] = useState(1);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const serviceRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);

  const locationServices = useMemo(
    () => locationId ? services.filter((item) => item.locations.some((link) => link.locationId === locationId)) : [],
    [locationId, services],
  );
  const service = useMemo(() => locationServices.find((item) => item.id === serviceId), [locationServices, serviceId]);
  const isSessionType = service?.bookingType === "CLASS" || service?.bookingType === "EVENT";
  const selectedSession = useMemo(() => sessions.find((item) => item.id === sessionId), [sessions, sessionId]);
  const categories = useMemo(() => [...new Set(locationServices.map((item) => item.category || "General"))], [locationServices]);
  const paymentPolicy = (service?.depositPolicy ?? {}) as { enabled?: boolean; mode?: "DEPOSIT" | "FULL"; percent?: number };
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index)), [weekStart]);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 });
  const assignmentReady = Boolean(
    service &&
    locationId &&
    !isSessionType &&
    (service.professionalMode !== "REQUIRED" || professionalId) &&
    (service.resourceMode !== "REQUIRED" || resourceId),
  );
  const selectionReady = isSessionType ? Boolean(selectedSession) : Boolean(slot);
  const partyMax = isSessionType ? Math.min(service?.maxPartySize ?? 1, selectedSession?.available ?? 1) : service?.maxPartySize ?? 1;
  const fullSessions = useMemo(() => sessions.filter((item) => item.available < (service?.minPartySize ?? 1)), [sessions, service?.minPartySize]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadTimedSlots() {
      await Promise.resolve();
      if (!assignmentReady || isSessionType) {
        setSlots([]);
        return;
      }
      setLoadingAvailability(true);
      setError("");
      setSlot("");
      const qs = new URLSearchParams({
        locationId,
        serviceId,
        date,
        ...(professionalId ? { professionalId } : {}),
        ...(resourceId ? { resourceId } : {}),
      });
      try {
        const response = await fetch(`/api/public/${slug}/availability?${qs}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No pudimos consultar horarios");
        setSlots(body.slots);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally {
        setLoadingAvailability(false);
      }
    }
    void loadTimedSlots();
    return () => controller.abort();
  }, [assignmentReady, date, isSessionType, locationId, professionalId, resourceId, serviceId, slug]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSessions() {
      await Promise.resolve();
      if (!service || !isSessionType || !locationId) {
        setSessions([]);
        return;
      }
      setLoadingAvailability(true);
      setError("");
      setSessionId("");
      try {
        const qs = new URLSearchParams({ locationId, serviceId: service.id });
        const response = await fetch(`/api/public/${slug}/sessions?${qs}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No pudimos consultar sesiones");
        setSessions(body.sessions);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally {
        setLoadingAvailability(false);
      }
    }
    void loadSessions();
    return () => controller.abort();
  }, [isSessionType, locationId, service, serviceId, slug]);

  const glideTo = (target: React.RefObject<HTMLElement | null>) => setTimeout(() => target.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);

  function chooseLocation(id: string) {
    setLocation(id);
    setSlot("");
    setSessionId("");
    setProfessional("");
    setResource("");
    if (!services.find((item) => item.id === serviceId)?.locations.some((link) => link.locationId === id)) setServiceId("");
    glideTo(serviceRef);
  }

  function chooseService(id: string) {
    const next = locationServices.find((item) => item.id === id);
    const sessionBased = next?.bookingType === "CLASS" || next?.bookingType === "EVENT";
    setServiceId(id);
    setProfessional(!sessionBased && next?.professionalMode === "REQUIRED" ? next.professionals[0]?.professional.id ?? "" : "");
    setResource(!sessionBased && next?.resourceMode === "REQUIRED" ? next.resources[0]?.resource.id ?? "" : "");
    setPartySize(next?.minPartySize ?? 1);
    setSlot("");
    setSessionId("");
    glideTo(timeRef);
  }

  function chooseSlot(value: string) {
    setSlot(value);
    glideTo(detailsRef);
  }

  function chooseSession(value: string) {
    const next = sessions.find((item) => item.id === value);
    setSessionId(value);
    if (next && service) setPartySize(Math.min(Math.max(service.minPartySize, 1), next.available));
    glideTo(detailsRef);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customValues = Object.fromEntries((service?.customFields ?? []).map((field) => [
      field.id,
      field.type === "MULTI_SELECT"
        ? formData.getAll(`custom_${field.id}`)
        : field.type === "CHECKBOX"
          ? formData.has(`custom_${field.id}`)
          : formData.get(`custom_${field.id}`),
    ]));

    start(async () => {
      try {
        const result = await createPublicBookingAction({
          tenantSlug: slug,
          locationId,
          serviceId,
          professionalId: !isSessionType && professionalId ? professionalId : undefined,
          resourceId: !isSessionType && resourceId ? resourceId : undefined,
          sessionId: isSessionType ? sessionId : undefined,
          startsAt: !isSessionType ? slot : undefined,
          partySize,
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          customValues,
        });
        if (result.paymentRequired && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pudimos crear la reserva");
      }
    });
  }

  if (done) {
    return (
      <div className="wizard success">
        <div className="success-icon">✓</div>
        <span className="eyebrow">Reserva confirmada</span>
        <h2>¡Listo! Tu reserva quedó agendada.</h2>
        <p className="muted">Podés administrarla desde tu cuenta o comunicarte con el negocio si necesitás un cambio.</p>
      </div>
    );
  }

  const selectedDate = isSessionType ? selectedSession?.startsAt : slot;
  const paymentTotal = service?.priceCents ? (service.priceCents / 100) * partySize * (paymentPolicy.mode === "FULL" ? 1 : (paymentPolicy.percent ?? 30) / 100) : 0;

  return (
    <div className="booking-flow">
      {error && <p className="error">{error}</p>}

      <section className="booking-selection card">
        <div className="booking-section-title">
          <span className="selection-number">1</span>
          <div><h2>Elegí qué querés reservar</h2><p className="muted">Seleccioná la sede y luego la opción que necesitás.</p></div>
        </div>

        <div className="choice-chips">
          {locations.map((item) => (
            <button type="button" className={locationId === item.id ? "active" : ""} onClick={() => chooseLocation(item.id)} key={item.id}>
              {item.name}<small>{item.address || "Atención disponible"}</small>
            </button>
          ))}
        </div>

        <div className={`service-cards ${locationId ? "" : "locked-choice"}`} ref={serviceRef}>
          {locationId && !locationServices.length && <div className="empty" style={{ gridColumn: "1/-1" }}>Esta sede todavía no tiene opciones disponibles online.</div>}
          {categories.flatMap((category) => locationServices.filter((item) => (item.category || "General") === category).map((item) => {
            const policy = (item.depositPolicy ?? {}) as { enabled?: boolean; mode?: string; percent?: number };
            return (
              <button type="button" className={serviceId === item.id ? "active" : ""} onClick={() => chooseService(item.id)} key={item.id}>
                <span className="service-color" style={{ background: item.color }} />
                <span>
                  <small style={{ textTransform: "uppercase", letterSpacing: ".05em" }}>{category} · {bookingTypeLabel[item.bookingType]}</small>
                  <strong>{item.name}</strong>
                  <small>{item.durationMinutes} min{item.maxPartySize > 1 ? ` · hasta ${item.maxPartySize} personas` : ""}</small>
                  {item.description && <small>{item.description}</small>}
                  {policy.enabled && <em>{policy.mode === "FULL" ? "Pago online" : `Seña online ${policy.percent ?? 30}%`}</em>}
                </span>
                <b>{item.priceCents == null ? "" : money.format(item.priceCents / 100)}</b>
              </button>
            );
          }))}
        </div>

        {service && !isSessionType && (
          <div className="assignment-row">
            {service.professionalMode !== "NONE" && service.professionals.length > 0 && (
              <div className="field">
                <label>{service.professionalMode === "REQUIRED" ? "Profesional *" : "Profesional (opcional)"}</label>
                <select className="select" value={professionalId} onChange={(event) => setProfessional(event.target.value)}>
                  {service.professionalMode !== "REQUIRED" && <option value="">Sin preferencia</option>}
                  {service.professionals.map((item) => <option value={item.professional.id} key={item.professional.id}>{item.professional.name}</option>)}
                </select>
              </div>
            )}
            {service.resourceMode !== "NONE" && service.resources.length > 0 && (
              <div className="field">
                <label>{service.resourceMode === "REQUIRED" ? "Recurso *" : "Recurso (opcional)"}</label>
                <select className="select" value={resourceId} onChange={(event) => setResource(event.target.value)}>
                  {service.resourceMode !== "REQUIRED" && <option value="">Sin preferencia</option>}
                  {service.resources.map((item) => <option value={item.resource.id} key={item.resource.id}>{item.resource.name}{item.resource.type ? ` · ${item.resource.type}` : ""}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={`booking-time card guided-section ${service ? "ready" : "locked"}`} ref={timeRef}>
        <div className="booking-section-title">
          <span className="selection-number">2</span>
          <div><h2>{isSessionType ? "Elegí una sesión" : "Fecha y hora"}</h2><p className="muted">{isSessionType ? "Mostramos las próximas fechas con cupo disponible." : "Sólo mostramos horarios que cumplen todas las reglas de agenda."}</p></div>
        </div>

        {isSessionType ? (
          <>
            {loadingAvailability && <div className="empty">Buscando próximas sesiones…</div>}
            {!loadingAvailability && sessions.length > 0 && (
              <div className="service-cards">
                {sessions.map((item) => {
                  const full = item.available < (service?.minPartySize ?? 1);
                  return (
                    <button type="button" disabled={full} className={sessionId === item.id ? "active" : ""} onClick={() => chooseSession(item.id)} key={item.id}>
                      <span>
                        <small>{new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "2-digit", month: "short", timeZone: timezone }).format(new Date(item.startsAt))}</small>
                        <strong>{item.title || service?.name}</strong>
                        <small>{new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(item.startsAt))} · {item.professional?.name || item.resource?.name || "Sesión programada"}</small>
                      </span>
                      <b>{full ? "Completo" : `${item.available} lugar${item.available === 1 ? "" : "es"}`}</b>
                    </button>
                  );
                })}
              </div>
            )}
            {!loadingAvailability && !sessions.length && <div className="empty">No hay próximas sesiones publicadas con disponibilidad.</div>}
            {!loadingAvailability && service?.allowWaitlist && !sessions.length && (
              <WaitlistForm slug={slug} locationId={locationId} serviceId={service.id} minPartySize={service.minPartySize} maxPartySize={service.maxPartySize} customer={customer} />
            )}
            {!loadingAvailability && service?.allowWaitlist && fullSessions.map((item) => (
              <WaitlistForm key={item.id} slug={slug} locationId={locationId} serviceId={service.id} sessionId={item.id} minPartySize={service.minPartySize} maxPartySize={Math.max(service.minPartySize, service.maxPartySize)} customer={customer} />
            ))}
          </>
        ) : (
          <>
            <div className="date-navigation">
              <button type="button" disabled={!service} onClick={() => setWeekStart(addUtcDays(weekStart, -7))} aria-label="Semana anterior">‹</button>
              <div className="date-strip">
                {days.map((item) => {
                  const value = new Date(`${item}T12:00:00Z`);
                  return (
                    <button type="button" disabled={!service} className={date === item ? "active" : ""} onClick={() => setDate(item)} key={item}>
                      <small>{new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" }).format(value)}</small>
                      <strong>{value.getUTCDate()}</strong>
                      <span>{new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" }).format(value)}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" disabled={!service} onClick={() => setWeekStart(addUtcDays(weekStart, 7))} aria-label="Semana siguiente">›</button>
            </div>
            <div className="more-date"><label>Ir a otra fecha</label><input type="date" className="input" value={date} min={isoDate(new Date())} onChange={(event) => { setDate(event.target.value); setWeekStart(event.target.value); }} /></div>
            {loadingAvailability
              ? <div className="empty">Buscando horarios disponibles…</div>
              : <div className="time-groups">{slots.map((value) => <button type="button" className={slot === value ? "active" : ""} onClick={() => chooseSlot(value)} key={value}>{new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value))}</button>)}</div>}
            {!loadingAvailability && assignmentReady && !slots.length && <div className="empty">No hay horarios libres este día. Elegí otra fecha.</div>}
            {!loadingAvailability && assignmentReady && !slots.length && service?.allowWaitlist && (
              <WaitlistForm slug={slug} locationId={locationId} serviceId={service.id} professionalId={professionalId || undefined} resourceId={resourceId || undefined} preferredDate={date} minPartySize={service.minPartySize} maxPartySize={service.maxPartySize} customer={customer} />
            )}
            {!assignmentReady && <div className="empty">Completá las selecciones requeridas para consultar disponibilidad.</div>}
          </>
        )}
      </section>

      <section className={`booking-details card guided-section ${selectionReady ? "ready" : "locked"}`} ref={detailsRef}>
        <div className="booking-section-title">
          <span className="selection-number">3</span>
          <div><h2>Tus datos</h2><p className="muted">{selectedDate ? new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(selectedDate)) : "Primero elegí una fecha y horario"}</p></div>
        </div>

        {selectionReady && service && (
          <form onSubmit={submit}>
            {(service.maxPartySize > 1 || isSessionType) && (
              <div className="field">
                <label>Cantidad de asistentes</label>
                <input className="input" name="partySize" type="number" min={service.minPartySize} max={Math.max(service.minPartySize, partyMax)} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} required />
                <small className="muted">Disponible para esta reserva: hasta {Math.max(service.minPartySize, partyMax)}.</small>
              </div>
            )}

            <div className="customer-grid">
              <div className="field"><label>Nombre *</label><input className="input" name="firstName" autoComplete="given-name" defaultValue={customer?.firstName} required /></div>
              <div className="field"><label>Apellido</label><input className="input" name="lastName" autoComplete="family-name" defaultValue={customer?.lastName} /></div>
              <div className="field"><label>Teléfono *</label><input className="input" name="phone" type="tel" autoComplete="tel" defaultValue={customer?.phone} required /></div>
              <div className="field"><label>Email</label><input className="input" name="email" type="email" autoComplete="email" defaultValue={customer?.email} required={Boolean(paymentPolicy.enabled)} /></div>
            </div>

            {service.customFields.map((field) => <DynamicField key={field.id} field={field} />)}
            <p className="muted booking-policy">{cancellationHours > 0 ? `Solicitá cancelaciones o cambios con al menos ${cancellationHours} horas de anticipación.` : "Consultá al negocio por cancelaciones o cambios."}</p>

            {paymentPolicy.enabled && service.priceCents && (
              <div className="payment-callout">
                <strong>{paymentPolicy.mode === "FULL" ? "Pago total" : "Seña para confirmar"}</strong>
                <span>{money.format(paymentTotal)}</span>
                <small>{partySize > 1 ? `${partySize} asistentes · ` : ""}Serás redirigido a Mercado Pago para confirmar.</small>
              </div>
            )}

            <button className="button confirm-booking" disabled={pending}>{pending ? "Procesando…" : paymentPolicy.enabled ? "Reservar y pagar con Mercado Pago" : `Confirmar ${service.bookingType === "CLASS" ? "clase" : service.bookingType === "EVENT" ? "evento" : "reserva"}`}</button>
          </form>
        )}
      </section>
    </div>
  );
}

function DynamicField({ field }: { field: CustomField }) {
  const name = `custom_${field.id}`;
  const options = Array.isArray(field.options) ? field.options.map(String) : [];
  if (field.type === "TEXTAREA") return <div className="field"><label>{field.label}{field.required ? " *" : ""}</label><textarea className="input" name={name} required={field.required} rows={3} /></div>;
  if (field.type === "SELECT") return <div className="field"><label>{field.label}{field.required ? " *" : ""}</label><select className="select" name={name} required={field.required}><option value="">Seleccionar</option>{options.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (field.type === "MULTI_SELECT") return <div className="field"><label>{field.label}{field.required ? " *" : ""}</label><select className="select" name={name} required={field.required} multiple size={Math.min(4, Math.max(2, options.length))}>{options.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (field.type === "CHECKBOX") return <label className="field checkbox-field"><input type="checkbox" name={name} required={field.required} /><span>{field.label}{field.required ? " *" : ""}</span></label>;
  const type = { NUMBER: "number", PHONE: "tel", EMAIL: "email", DATE: "date", TEXT: "text" }[field.type] ?? "text";
  return <div className="field"><label>{field.label}{field.required ? " *" : ""}</label><input className="input" name={name} type={type} required={field.required} /></div>;
}

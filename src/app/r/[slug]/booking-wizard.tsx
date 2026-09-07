"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPublicBookingAction } from "@/app/actions/public-booking";

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
  durationMinutes: number;
  preparationMinutes: number;
  bufferMinutes: number;
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
  const [loadingSlots, setLoadingSlots] = useState(false);
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
  const categories = useMemo(
    () => [...new Set(locationServices.map((item) => item.category || "General"))],
    [locationServices],
  );
  const paymentPolicy = (service?.depositPolicy ?? {}) as { enabled?: boolean; mode?: "DEPOSIT" | "FULL"; percent?: number };
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index)), [weekStart]);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 });
  const assignmentReady = Boolean(
    service &&
    locationId &&
    (service.professionalMode !== "REQUIRED" || professionalId) &&
    (service.resourceMode !== "REQUIRED" || resourceId),
  );

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await Promise.resolve();
      if (!assignmentReady) {
        setSlots([]);
        return;
      }
      setLoadingSlots(true);
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
        const res = await fetch(`/api/public/${slug}/availability?${qs}`, { signal: controller.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "No pudimos consultar horarios");
        setSlots(body.slots);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally {
        setLoadingSlots(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [assignmentReady, date, locationId, professionalId, resourceId, serviceId, slug]);

  const glideTo = (target: React.RefObject<HTMLElement | null>) => setTimeout(() => target.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);

  function chooseLocation(id: string) {
    setLocation(id);
    setSlot("");
    setProfessional("");
    setResource("");
    if (!services.find((item) => item.id === serviceId)?.locations.some((link) => link.locationId === id)) setServiceId("");
    glideTo(serviceRef);
  }

  function chooseService(id: string) {
    const next = locationServices.find((item) => item.id === id);
    setServiceId(id);
    setProfessional(next?.professionalMode === "REQUIRED" ? next.professionals[0]?.professional.id ?? "" : "");
    setResource(next?.resourceMode === "REQUIRED" ? next.resources[0]?.resource.id ?? "" : "");
    setSlot("");
    glideTo(timeRef);
  }

  function chooseSlot(value: string) {
    setSlot(value);
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
          professionalId: professionalId || undefined,
          resourceId: resourceId || undefined,
          startsAt: slot,
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
        <p className="muted">Ya podés cerrar esta pantalla. El negocio recibió tus datos.</p>
      </div>
    );
  }

  return (
    <div className="booking-flow">
      {error && <p className="error">{error}</p>}

      <section className="booking-selection card">
        <div className="booking-section-title">
          <span className="selection-number">1</span>
          <div><h2>Elegí qué querés reservar</h2><p className="muted">Primero la sede y después el servicio disponible allí.</p></div>
        </div>

        <div className="choice-chips">
          {locations.map((item) => (
            <button type="button" className={locationId === item.id ? "active" : ""} onClick={() => chooseLocation(item.id)} key={item.id}>
              {item.name}<small>{item.address || "Atención disponible"}</small>
            </button>
          ))}
        </div>

        <div className={`service-cards ${locationId ? "" : "locked-choice"}`} ref={serviceRef}>
          {locationId && !locationServices.length && <div className="empty" style={{ gridColumn: "1/-1" }}>Esta sede todavía no tiene servicios disponibles online.</div>}
          {categories.flatMap((category) => locationServices.filter((item) => (item.category || "General") === category).map((item) => {
            const policy = (item.depositPolicy ?? {}) as { enabled?: boolean; mode?: string; percent?: number };
            return (
              <button type="button" className={serviceId === item.id ? "active" : ""} onClick={() => chooseService(item.id)} key={item.id}>
                <span className="service-color" style={{ background: item.color }} />
                <span>
                  <small style={{ textTransform: "uppercase", letterSpacing: ".05em" }}>{category}</small>
                  <strong>{item.name}</strong>
                  <small>
                    {item.durationMinutes} min
                    {item.preparationMinutes ? ` · preparación ${item.preparationMinutes} min` : ""}
                    {item.bufferMinutes ? ` · buffer ${item.bufferMinutes} min` : ""}
                  </small>
                  {item.description && <small>{item.description}</small>}
                  {policy.enabled && <em>{policy.mode === "FULL" ? "Pago online" : `Seña online ${policy.percent ?? 30}%`}</em>}
                </span>
                <b>{item.priceCents == null ? "" : money.format(item.priceCents / 100)}</b>
              </button>
            );
          }))}
        </div>

        {service && (
          <div className="assignment-row">
            {service.professionalMode !== "NONE" && service.professionals.length > 0 && (
              <div className="field">
                <label>{service.professionalMode === "REQUIRED" ? "Profesional *" : "Profesional (opcional)"}</label>
                <select className="select" value={professionalId} onChange={(event) => setProfessional(event.target.value)}>
                  {service.professionalMode !== "REQUIRED" && <option value="">Sin profesional asignado</option>}
                  {service.professionals.map((item) => <option value={item.professional.id} key={item.professional.id}>{item.professional.name}</option>)}
                </select>
              </div>
            )}
            {service.resourceMode !== "NONE" && service.resources.length > 0 && (
              <div className="field">
                <label>{service.resourceMode === "REQUIRED" ? "Recurso *" : "Recurso (opcional)"}</label>
                <select className="select" value={resourceId} onChange={(event) => setResource(event.target.value)}>
                  {service.resourceMode !== "REQUIRED" && <option value="">Sin recurso asignado</option>}
                  {service.resources.map((item) => <option value={item.resource.id} key={item.resource.id}>{item.resource.name}{item.resource.type ? ` · ${item.resource.type}` : ""}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={`booking-time card guided-section ${service ? "ready" : "locked"}`} ref={timeRef}>
        <div className="booking-section-title"><span className="selection-number">2</span><div><h2>Fecha y hora</h2><p className="muted">Sólo mostramos horarios que cumplen las reglas de disponibilidad.</p></div></div>
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
        {loadingSlots
          ? <div className="empty">Buscando horarios disponibles…</div>
          : <div className="time-groups">{slots.map((value) => <button type="button" className={slot === value ? "active" : ""} onClick={() => chooseSlot(value)} key={value}>{new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value))}</button>)}</div>}
        {!loadingSlots && assignmentReady && !slots.length && <div className="empty">No hay horarios libres este día. Elegí otra fecha.</div>}
        {!assignmentReady && <div className="empty">Completá las selecciones requeridas para consultar disponibilidad.</div>}
      </section>

      <section className={`booking-details card guided-section ${slot ? "ready" : "locked"}`} ref={detailsRef}>
        <div className="booking-section-title">
          <span className="selection-number">3</span>
          <div><h2>Tus datos</h2><p className="muted">{slot ? new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(slot)) : "Primero elegí un horario"}</p></div>
        </div>
        {slot && (
          <form onSubmit={submit}>
            <div className="customer-grid">
              <div className="field"><label>Nombre *</label><input className="input" name="firstName" autoComplete="given-name" defaultValue={customer?.firstName} required /></div>
              <div className="field"><label>Apellido</label><input className="input" name="lastName" autoComplete="family-name" defaultValue={customer?.lastName} /></div>
              <div className="field"><label>Teléfono *</label><input className="input" name="phone" type="tel" autoComplete="tel" defaultValue={customer?.phone} required /></div>
              <div className="field"><label>Email</label><input className="input" name="email" type="email" autoComplete="email" defaultValue={customer?.email} required={Boolean(paymentPolicy.enabled)} /></div>
            </div>
            {service?.customFields.map((field) => <DynamicField key={field.id} field={field} />)}
            <p className="muted booking-policy">{cancellationHours > 0 ? `Solicitá cancelaciones o cambios con al menos ${cancellationHours} horas de anticipación.` : "Consultá al negocio por cancelaciones o cambios."}</p>
            {paymentPolicy.enabled && service?.priceCents && (
              <div className="payment-callout">
                <strong>{paymentPolicy.mode === "FULL" ? "Pago total" : "Seña para confirmar"}</strong>
                <span>{money.format((service.priceCents / 100) * (paymentPolicy.mode === "FULL" ? 1 : (paymentPolicy.percent ?? 30) / 100))}</span>
                <small>Serás redirigido a Mercado Pago. El horario queda reservado mientras completás el pago.</small>
              </div>
            )}
            <button className="button confirm-booking" disabled={pending}>{pending ? "Procesando…" : paymentPolicy.enabled ? "Reservar y pagar con Mercado Pago" : `Confirmar ${service?.name ?? "reserva"}`}</button>
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

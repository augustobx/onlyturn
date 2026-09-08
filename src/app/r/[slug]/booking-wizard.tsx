"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MapPin, Sparkles, UserRound } from "lucide-react";
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
type Addon = { id: string; name: string; description: string | null; priceCents: number; durationMinutes: number; preparationMinutes: number };
type CustomerPackage = { id: string; name: string; remainingUses: number; expiresAt: string | null; serviceIds: string[] };
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
  addons: Addon[];
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
type NextAvailabilityDay = { date: string; slots: string[] };

const bookingTypeLabel: Record<Service["bookingType"], string> = { APPOINTMENT: "Turno", CLASS: "Clase", EVENT: "Evento", RESOURCE: "Reserva" };
const addUtcDays = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const tenantToday = (timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const dateLabel = (date: string, style: "short" | "long" = "long") => new Intl.DateTimeFormat("es-AR", style === "short" ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" } : { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = (value: string, timezone: string) => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value));

export function BookingWizard({ slug, currency, timezone, cancellationHours, locations, services, packages, customer }: {
  slug: string;
  currency: string;
  timezone: string;
  cancellationHours: number;
  locations: Location[];
  services: Service[];
  packages: CustomerPackage[];
  customer?: { firstName: string; lastName: string; phone: string; email: string };
}) {
  const initialDate = useMemo(() => tenantToday(timezone), [timezone]);
  const [locationId, setLocation] = useState(() => locations.length === 1 ? locations[0].id : "");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessional] = useState("");
  const [resourceId, setResource] = useState("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [customerPackageId, setCustomerPackageId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [weekStart, setWeekStart] = useState(initialDate);
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [nextAvailability, setNextAvailability] = useState<NextAvailabilityDay[]>([]);
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

  const locationServices = useMemo(() => locationId ? services.filter((item) => item.locations.some((link) => link.locationId === locationId)) : [], [locationId, services]);
  const service = useMemo(() => locationServices.find((item) => item.id === serviceId), [locationServices, serviceId]);
  const isSessionType = service?.bookingType === "CLASS" || service?.bookingType === "EVENT";
  const selectedSession = useMemo(() => sessions.find((item) => item.id === sessionId), [sessions, sessionId]);
  const selectedAddons = useMemo(() => service?.addons.filter((addon) => addonIds.includes(addon.id)) ?? [], [addonIds, service]);
  const addonKey = useMemo(() => [...addonIds].sort().join(","), [addonIds]);
  const addonPriceCents = selectedAddons.reduce((sum, addon) => sum + addon.priceCents, 0);
  const addonDuration = selectedAddons.reduce((sum, addon) => sum + addon.durationMinutes, 0);
  const eligiblePackages = useMemo(() => service ? packages.filter((membership) => membership.serviceIds.includes(service.id) && membership.remainingUses >= partySize) : [], [packages, partySize, service]);
  const selectedPackage = eligiblePackages.find((membership) => membership.id === customerPackageId);
  const categories = useMemo(() => [...new Set(locationServices.map((item) => item.category || "General"))], [locationServices]);
  const paymentPolicy = (service?.depositPolicy ?? {}) as { enabled?: boolean; mode?: "DEPOSIT" | "FULL"; percent?: number };
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index)), [weekStart]);
  const money = useMemo(() => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }), [currency]);
  const assignmentReady = Boolean(service && locationId && !isSessionType && (service.professionalMode !== "REQUIRED" || professionalId) && (service.resourceMode !== "REQUIRED" || resourceId));
  const selectionReady = isSessionType ? Boolean(selectedSession) : Boolean(slot);
  const partyMax = isSessionType ? Math.min(service?.maxPartySize ?? 1, selectedSession?.available ?? 1) : service?.maxPartySize ?? 1;
  const fullSessions = useMemo(() => sessions.filter((item) => item.available < (service?.minPartySize ?? 1)), [sessions, service?.minPartySize]);
  const slotGroups = useMemo(() => {
    const result: { key: string; label: string; slots: string[] }[] = [
      { key: "morning", label: "Mañana", slots: [] },
      { key: "afternoon", label: "Tarde", slots: [] },
      { key: "evening", label: "Noche", slots: [] },
    ];
    slots.forEach((value) => {
      const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: timezone }).format(new Date(value)));
      (hour < 13 ? result[0] : hour < 19 ? result[1] : result[2]).slots.push(value);
    });
    return result.filter((group) => group.slots.length);
  }, [slots, timezone]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadTimedSlots() {
      await Promise.resolve();
      if (!assignmentReady || isSessionType) { setSlots([]); setNextAvailability([]); return; }
      setLoadingAvailability(true); setError(""); setSlot(""); setNextAvailability([]);
      const base = {
        locationId,
        serviceId,
        ...(professionalId ? { professionalId } : {}),
        ...(resourceId ? { resourceId } : {}),
        ...(addonKey ? { addons: addonKey } : {}),
      };
      try {
        const qs = new URLSearchParams({ ...base, date });
        const response = await fetch(`/api/public/${slug}/availability?${qs}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No pudimos consultar horarios");
        const currentSlots = Array.isArray(body.slots) ? [...new Set(body.slots as string[])] : [];
        setSlots(currentSlots);
        if (!currentSlots.length) {
          const nextQs = new URLSearchParams({ ...base, startDate: date });
          const nextResponse = await fetch(`/api/public/${slug}/availability-window?${nextQs}`, { signal: controller.signal });
          const nextBody = await nextResponse.json();
          if (nextResponse.ok && Array.isArray(nextBody.days)) setNextAvailability(nextBody.days);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally { setLoadingAvailability(false); }
    }
    void loadTimedSlots();
    return () => controller.abort();
  }, [addonKey, assignmentReady, date, isSessionType, locationId, professionalId, resourceId, serviceId, slug]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSessions() {
      await Promise.resolve();
      if (!service || !isSessionType || !locationId) { setSessions([]); return; }
      setLoadingAvailability(true); setError(""); setSessionId("");
      try {
        const qs = new URLSearchParams({ locationId, serviceId: service.id });
        const response = await fetch(`/api/public/${slug}/sessions?${qs}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "No pudimos consultar sesiones");
        setSessions(body.sessions);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally { setLoadingAvailability(false); }
    }
    void loadSessions();
    return () => controller.abort();
  }, [isSessionType, locationId, service, slug]);

  const glideTo = (target: React.RefObject<HTMLElement | null>) => window.setTimeout(() => target.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  function chooseLocation(id: string) { setLocation(id); setSlot(""); setSessionId(""); setProfessional(""); setResource(""); setAddonIds([]); setCustomerPackageId(""); if (!services.find((item) => item.id === serviceId)?.locations.some((link) => link.locationId === id)) setServiceId(""); glideTo(serviceRef); }
  function chooseService(id: string) { const next = locationServices.find((item) => item.id === id); const sessionBased = next?.bookingType === "CLASS" || next?.bookingType === "EVENT"; setServiceId(id); setProfessional(!sessionBased && next?.professionalMode === "REQUIRED" ? next.professionals[0]?.professional.id ?? "" : ""); setResource(!sessionBased && next?.resourceMode === "REQUIRED" ? next.resources[0]?.resource.id ?? "" : ""); setAddonIds([]); setCustomerPackageId(""); setPartySize(next?.minPartySize ?? 1); setSlot(""); setSessionId(""); setDate(initialDate); setWeekStart(initialDate); glideTo(timeRef); }
  function toggleAddon(id: string) { setAddonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); setSlot(""); }
  function updatePartySize(value: number) { setPartySize(value); const current = packages.find((membership) => membership.id === customerPackageId); if (current && current.remainingUses < value) setCustomerPackageId(""); }
  function chooseSlot(value: string) { setSlot(value); glideTo(detailsRef); }
  function chooseNextDay(value: string) { setDate(value); setWeekStart(value); setSlot(""); setNextAvailability([]); window.setTimeout(() => timeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }
  function chooseSession(value: string) { const next = sessions.find((item) => item.id === value); setSessionId(value); if (next && service) updatePartySize(Math.min(Math.max(service.minPartySize, 1), next.available)); glideTo(detailsRef); }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const formData = new FormData(event.currentTarget);
    const customValues = Object.fromEntries((service?.customFields ?? []).map((field) => [field.id, field.type === "MULTI_SELECT" ? formData.getAll(`custom_${field.id}`) : field.type === "CHECKBOX" ? formData.has(`custom_${field.id}`) : formData.get(`custom_${field.id}`)]));
    start(async () => {
      try {
        const result = await createPublicBookingAction({ tenantSlug: slug, locationId, serviceId, professionalId: !isSessionType && professionalId ? professionalId : undefined, resourceId: !isSessionType && resourceId ? resourceId : undefined, sessionId: isSessionType ? sessionId : undefined, startsAt: !isSessionType ? slot : undefined, addonIds, customerPackageId: selectedPackage?.id, partySize, firstName: formData.get("firstName"), lastName: formData.get("lastName"), phone: formData.get("phone"), email: formData.get("email"), customValues });
        if (result.paymentRequired && result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
        setDone(true);
      } catch (err) { setError(err instanceof Error ? err.message : "No pudimos crear la reserva"); }
    });
  }

  const selectedDate = isSessionType ? selectedSession?.startsAt : slot;
  const totalPriceCents = (service?.priceCents ?? 0) * partySize + addonPriceCents;
  const payablePriceCents = selectedPackage ? addonPriceCents : totalPriceCents;
  const paymentTotal = (payablePriceCents / 100) * (paymentPolicy.mode === "FULL" ? 1 : (paymentPolicy.percent ?? 30) / 100);

  if (done) {
    return (
      <div className="bw-ticket">
        <div className="bw-ticket-head">
          <div className="bw-ticket-icon">
            <Check size={32} />
          </div>
          <span className="eyebrow" style={{ color: "var(--brand)" }}>Reserva Confirmada</span>
          <h2 style={{ margin: "6px 0 4px", fontSize: "1.4rem" }}>¡Tu turno quedó agendado!</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.86rem" }}>
            Ya podés gestionarlo desde tu cuenta.
          </p>
        </div>
        <div className="bw-ticket-body">
          <div className="bw-ticket-row">
            <span>Servicio</span>
            <strong>{service?.name}</strong>
          </div>
          {selectedDate && (
            <div className="bw-ticket-row">
              <span>Fecha y hora</span>
              <strong>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(selectedDate))}</strong>
            </div>
          )}
          {locationId && (
            <div className="bw-ticket-row">
              <span>Sede</span>
              <strong>{locations.find((l) => l.id === locationId)?.name}</strong>
            </div>
          )}
          {totalPriceCents > 0 && (
            <div className="bw-ticket-row">
              <span>Total</span>
              <strong style={{ color: "var(--brand)" }}>{money.format(totalPriceCents / 100)}</strong>
            </div>
          )}
        </div>
        <div className="bw-ticket-actions">
          <a className="button" href="/mi-cuenta" style={{ width: "100%", justifyContent: "center" }}>
            Ver mis turnos en Mi Cuenta
          </a>
          <button
            type="button"
            className="button secondary"
            onClick={() => { setDone(false); setServiceId(""); setSlot(""); }}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Hacer otra reserva
          </button>
        </div>
      </div>
    );
  }

  return <div className="bw-flow">
    {error && <div className="bw-error"><strong>No pudimos continuar</strong><span>{error}</span></div>}

    {/* Modern Stepper Indicator */}
    <div className="bw-stepper">
      <div className={`bw-step ${!service ? "active" : "done"}`}>
        <span className="bw-step-num">{service ? <Check size={12} /> : "1"}</span>
        <span>1. Servicio</span>
      </div>
      <div className={`bw-step ${service && !selectionReady ? "active" : selectionReady ? "done" : ""}`}>
        <span className="bw-step-num">{selectionReady ? <Check size={12} /> : "2"}</span>
        <span>2. Horario</span>
      </div>
      <div className={`bw-step ${selectionReady ? "active" : ""}`}>
        <span className="bw-step-num">3</span>
        <span>3. Confirmar</span>
      </div>
    </div>

    <section className="bw-section bw-card">
      <div className="bw-section-title">
        <span className="bw-num">1</span>
        <div>
          <h2>¿Qué querés reservar?</h2>
          <p className="muted">Elegí la sede y el servicio. OnlyTurn se ocupa de cruzar la disponibilidad.</p>
        </div>
      </div>

      {locations.length > 1 && (
        <>
          <span className="bw-label"><MapPin size={14}/> Sede de atención</span>
          <div className="bw-chips">
            {locations.map((item) => (
              <button type="button" className={locationId === item.id ? "active" : ""} onClick={() => chooseLocation(item.id)} key={item.id}>
                <strong>{item.name}</strong>
                <small>{item.address || "Atención presencial"}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {locations.length === 1 && (
        <div className="bw-single-loc">
          <MapPin size={15}/>
          <span><strong>{locations[0].name}</strong>{locations[0].address && <small>{locations[0].address}</small>}</span>
        </div>
      )}

      <div className={`bw-services ${locationId ? "" : "bw-locked"}`} ref={serviceRef}>
        {locationId && !locationServices.length && <div className="bw-empty" style={{ gridColumn: "1/-1" }}>Esta sede todavía no tiene opciones disponibles online.</div>}
        {categories.flatMap((category) => locationServices.filter((item) => (item.category || "General") === category).map((item) => {
          const isSelected = serviceId === item.id;
          const policy = (item.depositPolicy ?? {}) as { enabled?: boolean; mode?: string; percent?: number };
          return (
            <button
              type="button"
              className={`bw-svc ${isSelected ? "active" : ""}`}
              onClick={() => chooseService(item.id)}
              key={item.id}
            >
              <span className="bw-svc-cat">{category}</span>
              <h3 className="bw-svc-title">{item.name}</h3>
              {item.description && <p className="bw-svc-desc">{item.description}</p>}
              <div className="bw-svc-foot">
                <span className="bw-svc-dur">
                  <Clock3 size={14} /> {item.durationMinutes} min
                </span>
                <span className="bw-svc-price">
                  {item.priceCents == null ? "A consultar" : money.format(item.priceCents / 100)}
                </span>
              </div>
              {isSelected && <div className="bw-svc-check"><Check size={16} /></div>}
            </button>
          );
        }))}
      </div>

      {service && !isSessionType && (service.professionalMode !== "NONE" || service.resourceMode !== "NONE") && (
        <div className="bw-assign">
          <div className="bw-assign-intro">
            <UserRound size={16}/>
            <span><strong>Preferencia de atención</strong><small>Si no elegís una preferencia, OnlyTurn puede asignar automáticamente cuando el servicio lo permite.</small></span>
          </div>
          {service.professionalMode !== "NONE" && service.professionals.length > 0 && (
            <div className="field">
              <label>{service.professionalMode === "REQUIRED" ? "Profesional *" : "Profesional"}</label>
              <select className="select" value={professionalId} onChange={(event) => { setProfessional(event.target.value); setSlot(""); }}>
                {service.professionalMode !== "REQUIRED" && <option value="">Cualquiera disponible</option>}
                {service.professionals.map((item) => <option value={item.professional.id} key={item.professional.id}>{item.professional.name}</option>)}
              </select>
            </div>
          )}
          {service.resourceMode !== "NONE" && service.resources.length > 0 && (
            <div className="field">
              <label>{service.resourceMode === "REQUIRED" ? "Recurso *" : "Recurso"}</label>
              <select className="select" value={resourceId} onChange={(event) => { setResource(event.target.value); setSlot(""); }}>
                {service.resourceMode !== "REQUIRED" && <option value="">Cualquiera disponible</option>}
                {service.resources.map((item) => <option value={item.resource.id} key={item.resource.id}>{item.resource.name}{item.resource.type ? ` · ${item.resource.type}` : ""}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {service?.addons.length ? (
        <div className="bw-addons">
          <div className="bw-addon-head">
            <div>
              <span className="bw-label"><Sparkles size={14}/> Extras</span>
              <h3>¿Querés agregar algo?</h3>
            </div>
            <span className="muted">Opcional</span>
          </div>
          <div className="bw-addon-grid">
            {service.addons.map((addon) => {
              const selected = addonIds.includes(addon.id);
              return (
                <label className={`bw-addon ${selected ? "active" : ""}`} key={addon.id}>
                  <span>
                    <strong>{addon.name}</strong>
                    {addon.description && <small>{addon.description}</small>}
                    <small>{addon.durationMinutes ? `+${addon.durationMinutes} min · ` : ""}{money.format(addon.priceCents / 100)}</small>
                  </span>
                  <input type="checkbox" checked={selected} onChange={() => toggleAddon(addon.id)} />
                </label>
              );
            })}
          </div>
          {selectedAddons.length > 0 && (
            <div className="bw-addon-sum">
              Extras seleccionados: <strong>{money.format(addonPriceCents / 100)}</strong>{!isSessionType && addonDuration ? ` · +${addonDuration} min` : ""}
            </div>
          )}
        </div>
      ) : null}
    </section>

    <section className={`bw-section bw-card bw-guided ${service ? "bw-ready" : "bw-locked-section"}`} ref={timeRef}>
      <div className="bw-section-title">
        <span className="bw-num">2</span>
        <div>
          <h2>{isSessionType ? "Elegí una fecha" : "¿Cuándo te queda bien?"}</h2>
          <p className="muted">{isSessionType ? "Mostramos sólo sesiones con cupo real." : "Los horarios que ves ya están libres; no necesitás comprobar nada más."}</p>
        </div>
      </div>
      {isSessionType ? <>
        {loadingAvailability && <AvailabilityLoading />}
        {!loadingAvailability && sessions.length > 0 && <div className="bw-sessions">{sessions.map((item) => { const full = item.available < (service?.minPartySize ?? 1); return <button type="button" disabled={full} className={sessionId === item.id ? "active" : ""} onClick={() => chooseSession(item.id)} key={item.id}><span className="bw-session-date"><strong>{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: timezone }).format(new Date(item.startsAt))}</strong><small>{new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: timezone }).format(new Date(item.startsAt))}</small></span><span><strong>{item.title || service?.name}</strong><small><Clock3 size={12}/>{timeLabel(item.startsAt, timezone)} · {item.professional?.name || item.resource?.name || "Sesión"}</small></span><b>{full ? "Completo" : `${item.available} libres`}</b></button>; })}</div>}
        {!loadingAvailability && !sessions.length && <div className="bw-empty">No hay próximas sesiones publicadas con disponibilidad.</div>}
        {!loadingAvailability && service?.allowWaitlist && !sessions.length && <WaitlistForm slug={slug} locationId={locationId} serviceId={service.id} minPartySize={service.minPartySize} maxPartySize={service.maxPartySize} customer={customer} />}
        {!loadingAvailability && service?.allowWaitlist && fullSessions.map((item) => <WaitlistForm key={item.id} slug={slug} locationId={locationId} serviceId={service.id} sessionId={item.id} minPartySize={service.minPartySize} maxPartySize={Math.max(service.minPartySize, service.maxPartySize)} customer={customer} />)}
      </> : <>
        <div className="bw-date-nav">
          <button type="button" disabled={!service} onClick={() => setWeekStart(addUtcDays(weekStart, -7))} aria-label="Semana anterior"><ChevronLeft/></button>
          <div className="bw-dates">
            {days.map((item) => {
              const value = new Date(`${item}T12:00:00Z`);
              return (
                <button
                  type="button"
                  disabled={!service || item < initialDate}
                  className={date === item ? "active" : ""}
                  onClick={() => { setDate(item); setSlot(""); }}
                  key={item}
                >
                  <small>{new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" }).format(value)}</small>
                  <strong>{value.getUTCDate()}</strong>
                  <span>{new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" }).format(value)}</span>
                </button>
              );
            })}
          </div>
          <button type="button" disabled={!service} onClick={() => setWeekStart(addUtcDays(weekStart, 7))} aria-label="Semana siguiente"><ChevronRight/></button>
        </div>

        <div className="bw-day-line">
          <CalendarDays size={15}/>
          <strong>{dateLabel(date)}</strong>
          <input type="date" value={date} min={initialDate} onChange={(event) => { setDate(event.target.value); setWeekStart(event.target.value); setSlot(""); }} />
        </div>

        {loadingAvailability ? <AvailabilityLoading /> : slots.length > 0 ? (
          <div className="bw-times">
            {slotGroups.map((group) => (
              <section key={group.key}>
                <div className="bw-time-header">
                  <span>{group.key === "morning" ? "🌅 Mañana" : group.key === "afternoon" ? "☀️ Tarde" : "🌙 Noche"}</span>
                  <small>{group.slots.length} horario{group.slots.length === 1 ? "" : "s"}</small>
                </div>
                <div className="bw-slots">
                  {group.slots.map((value) => (
                    <button type="button" className={slot === value ? "active" : ""} onClick={() => chooseSlot(value)} key={value}>
                      {timeLabel(value, timezone)}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : assignmentReady ? (
          <div className="bw-no-slots">
            <span className="bw-no-slots-icon"><CalendarDays size={20} /></span>
            <h3>No hay lugar el {dateLabel(date, "short")}</h3>
            <p>Buscamos automáticamente las próximas fechas disponibles para este servicio.</p>
            {nextAvailability.length > 0 ? (
              <div className="bw-next-avail">
                <span className="bw-label"><Sparkles size={14}/> Próximos disponibles</span>
                {nextAvailability.map((day) => (
                  <button type="button" onClick={() => chooseNextDay(day.date)} key={day.date}>
                    <span>
                      <strong>{dateLabel(day.date)}</strong>
                      <small>{day.slots.length} horario{day.slots.length === 1 ? "" : "s"} · desde {timeLabel(day.slots[0], timezone)}</small>
                    </span>
                    <ChevronRight size={17}/>
                  </button>
                ))}
              </div>
            ) : (
              <small className="muted">No encontramos disponibilidad cercana. Probá otra semana o anotate en lista de espera.</small>
            )}
          </div>
        ) : (
          <div className="bw-empty">Completá las selecciones requeridas para consultar disponibilidad.</div>
        )}

        {!loadingAvailability && assignmentReady && !slots.length && service?.allowWaitlist && (
          <WaitlistForm slug={slug} locationId={locationId} serviceId={service.id} professionalId={professionalId || undefined} resourceId={resourceId || undefined} preferredDate={date} minPartySize={service.minPartySize} maxPartySize={service.maxPartySize} customer={customer} />
        )}
      </>}
    </section>

    <section className={`bw-section bw-card bw-guided ${selectionReady ? "bw-ready" : "bw-locked-section"}`} ref={detailsRef}>
      <div className="bw-section-title">
        <span className="bw-num">3</span>
        <div>
          <h2>Confirmá tu reserva</h2>
          <p className="muted">{selectedDate ? new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(selectedDate)) : "Primero elegí una fecha y horario"}</p>
        </div>
      </div>

      {selectionReady && service && (
        <form onSubmit={submit}>
          {(service.maxPartySize > 1 || isSessionType) && (
            <div className="field">
              <label>Cantidad de asistentes</label>
              <input className="input" name="partySize" type="number" min={service.minPartySize} max={Math.max(service.minPartySize, partyMax)} value={partySize} onChange={(event) => updatePartySize(Number(event.target.value))} required />
              <small className="muted">Hasta {Math.max(service.minPartySize, partyMax)} para esta reserva.</small>
            </div>
          )}

          {eligiblePackages.length > 0 && (
            <div className="field">
              <label>Paquete / membresía</label>
              <select className="select" value={customerPackageId} onChange={(event) => setCustomerPackageId(event.target.value)}>
                <option value="">No usar paquete</option>
                {eligiblePackages.map((membership) => (
                  <option value={membership.id} key={membership.id}>{membership.name} · {membership.remainingUses} uso{membership.remainingUses === 1 ? "" : "s"}</option>
                ))}
              </select>
            </div>
          )}

          <div className="bw-form-grid">
            <div className="field">
              <label>Nombre *</label>
              <input className="input" name="firstName" autoComplete="given-name" defaultValue={customer?.firstName} required />
            </div>
            <div className="field">
              <label>Apellido</label>
              <input className="input" name="lastName" autoComplete="family-name" defaultValue={customer?.lastName} />
            </div>
            <div className="field">
              <label>Teléfono *</label>
              <input className="input" name="phone" type="tel" autoComplete="tel" defaultValue={customer?.phone} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" name="email" type="email" autoComplete="email" defaultValue={customer?.email} required={Boolean(paymentPolicy.enabled && payablePriceCents > 0)} />
            </div>
          </div>

          {service.customFields.map((field) => <DynamicField key={field.id} field={field} />)}

          <p className="muted bw-policy">{cancellationHours > 0 ? `Podés solicitar cancelaciones o cambios con al menos ${cancellationHours} horas de anticipación.` : "Consultá al negocio por cancelaciones o cambios."}</p>

          {(service.priceCents != null || addonPriceCents > 0) && (
            <div className="bw-payment">
              <strong>{selectedPackage ? `Usando ${selectedPackage.name}` : "Total"}</strong>
              <span>{selectedPackage ? `${partySize} uso${partySize === 1 ? "" : "s"}` : money.format(totalPriceCents / 100)}</span>
              {selectedPackage && <small>{addonPriceCents > 0 ? `Extras a pagar: ${money.format(addonPriceCents / 100)}.` : "El servicio queda cubierto por tu membresía."}</small>}
            </div>
          )}

          {paymentPolicy.enabled && payablePriceCents > 0 && (
            <div className="bw-payment bw-payment-online">
              <strong>{paymentPolicy.mode === "FULL" ? "Pago para confirmar" : "Seña para confirmar"}</strong>
              <span>{money.format(paymentTotal)}</span>
              <small>Al confirmar te llevamos a Mercado Pago para abonar de forma segura.</small>
            </div>
          )}

          <button className="button bw-confirm" disabled={pending}>
            {pending ? "Confirmando tu reserva…" : paymentPolicy.enabled && payablePriceCents > 0 ? "Reservar y pagar con Mercado Pago" : selectedPackage ? `Confirmar con ${selectedPackage.name}` : "Confirmar reserva"}
          </button>
        </form>
      )}
    </section>
  </div>;
}

function AvailabilityLoading() { return <div className="bw-loading"><span/><span/><span/><small>Buscando los mejores horarios disponibles…</small></div>; }

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

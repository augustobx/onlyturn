"use client";

import { useState, useTransition } from "react";
import { createPublicWaitlistAction } from "@/app/actions/waitlist";

export function WaitlistForm({
  slug,
  locationId,
  serviceId,
  professionalId,
  resourceId,
  sessionId,
  preferredDate,
  minPartySize,
  maxPartySize,
  customer,
}: {
  slug: string;
  locationId: string;
  serviceId: string;
  professionalId?: string;
  resourceId?: string;
  sessionId?: string;
  preferredDate?: string;
  minPartySize: number;
  maxPartySize: number;
  customer?: { firstName: string; lastName: string; phone: string; email: string };
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (done) return <div className="success" style={{ padding: 14 }}><strong>✓ Te sumamos a la lista de espera.</strong><p className="muted" style={{ margin: "4px 0 0" }}>El negocio ya puede ver tu solicitud y contactarte cuando aparezca disponibilidad.</p></div>;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    start(async () => {
      try {
        await createPublicWaitlistAction({
          tenantSlug: slug,
          locationId,
          serviceId,
          professionalId,
          resourceId,
          sessionId,
          preferredDate,
          partySize: Number(formData.get("partySize") || minPartySize),
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          email: formData.get("email"),
        });
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pudimos agregarte a la lista de espera");
      }
    });
  }

  return (
    <details className="card" style={{ boxShadow: "none", marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>¿Querés que te avisemos si se libera un lugar?</summary>
      <p className="muted" style={{ fontSize: 12 }}>Dejá tus datos y la solicitud quedará visible para el negocio.</p>
      {error && <p className="error">{error}</p>}
      <form onSubmit={submit}>
        <div className="customer-grid">
          <div className="field"><label>Nombre *</label><input className="input" name="firstName" defaultValue={customer?.firstName} required /></div>
          <div className="field"><label>Apellido</label><input className="input" name="lastName" defaultValue={customer?.lastName} /></div>
          <div className="field"><label>Teléfono *</label><input className="input" name="phone" type="tel" defaultValue={customer?.phone} required /></div>
          <div className="field"><label>Email</label><input className="input" name="email" type="email" defaultValue={customer?.email} /></div>
        </div>
        {maxPartySize > 1 && <div className="field"><label>Personas</label><input className="input" name="partySize" type="number" min={minPartySize} max={maxPartySize} defaultValue={minPartySize} required /></div>}
        <button className="button secondary" disabled={pending}>{pending ? "Guardando…" : "Sumarme a la lista de espera"}</button>
      </form>
    </details>
  );
}

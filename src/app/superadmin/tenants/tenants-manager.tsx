"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { createTenantAction } from "@/app/actions/superadmin";

type Plan = { id: string; name: string; code: string; priceCents: number };
type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  planName: string | null;
  planPriceCents: number | null;
  subscriptionStatus: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  memberships: number;
  customers: number;
  bookings: number;
  locations: number;
  professionals: number;
};

const statusLabels: Record<string, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("es-AR");

export function TenantsManager({ tenants, plans }: { tenants: TenantRow[]; plans: Plan[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((tenant) =>
      tenant.name.toLowerCase().includes(q) ||
      tenant.slug.toLowerCase().includes(q) ||
      tenant.ownerEmail?.toLowerCase().includes(q) ||
      tenant.ownerName?.toLowerCase().includes(q)
    );
  }, [search, tenants]);

  function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        await createTenantAction(formData);
        form.reset();
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear el tenant.");
      }
    });
  }

  const defaultStart = new Date().toISOString().slice(0, 10);
  const defaultEndDate = new Date();
  defaultEndDate.setDate(defaultEndDate.getDate() + 14);
  const defaultEnd = defaultEndDate.toISOString().slice(0, 10);

  return (
    <div className="sa-stack">
      <div className="sa-page-head">
        <div>
          <h1><Building2 size={23} /> Gestión de Empresas (Tenants)</h1>
          <p>Aprovisionamiento, membresía, plan, owner y estado operativo de cada cliente OnlyTurn.</p>
        </div>
        <button className="sa-primary-button" type="button" onClick={() => { setError(""); setOpen(true); }}><Plus size={16} /> Aprovisionar empresa</button>
      </div>

      <div className="sa-search">
        <Search size={16} />
        <input className="sa-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, dominio, owner o email..." />
      </div>

      <section className="sa-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Empresa & dominio</th>
                <th>Owner</th>
                <th>Plan SaaS</th>
                <th>Recursos creados</th>
                <th>Membresía</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <strong>{tenant.name}</strong>
                    <small className="mono">{tenant.slug}.nanoapps.ar <a href={`https://${tenant.slug}.nanoapps.ar`} target="_blank" rel="noreferrer" aria-label={`Abrir ${tenant.name}`}><ExternalLink size={11} style={{ display: "inline" }} /></a></small>
                  </td>
                  <td>
                    <strong>{tenant.ownerName ?? "Sin owner"}</strong>
                    <small>{tenant.ownerEmail ?? "—"}</small>
                  </td>
                  <td>
                    <span className="sa-plan-pill">{tenant.planName ?? "Sin plan"}</span>
                    {tenant.planPriceCents !== null && <small className="success">{money.format(tenant.planPriceCents / 100)}/mes</small>}
                  </td>
                  <td>
                    <strong>{tenant.bookings} turnos</strong>
                    <small><Users size={11} style={{ display: "inline" }} /> {tenant.memberships} usuarios · {tenant.customers} clientes · {tenant.locations} sedes · {tenant.professionals} profesionales</small>
                  </td>
                  <td>
                    {tenant.membershipEnd ? <><strong>{date.format(new Date(tenant.membershipEnd))}</strong><small>{tenant.subscriptionStatus ?? "—"}</small></> : <span className="sa-muted">Sin membresía</span>}
                  </td>
                  <td>
                    <span className={`sa-status ${tenant.status.toLowerCase()}`}>
                      {tenant.status === "ACTIVE" && <CheckCircle2 size={11} />}
                      {tenant.status !== "ACTIVE" && <AlertCircle size={11} />}
                      {statusLabels[tenant.status] ?? tenant.status}
                    </span>
                  </td>
                  <td className="sa-table-action"><Link className="sa-secondary-button" href={`/superadmin/tenants/${tenant.id}`}><Settings size={13} /> Gestionar</Link></td>
                </tr>
              )) : <tr><td colSpan={7} className="sa-empty">No se encontraron empresas con ese criterio.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <div className="sa-modal-backdrop" role="presentation">
          <div className="sa-modal" role="dialog" aria-modal="true" aria-labelledby="create-tenant-title">
            <div className="sa-modal-head">
              <div>
                <h2 id="create-tenant-title">Aprovisionar nueva empresa SaaS</h2>
                <p>Se crea el tenant, su owner y la membresía inicial en una única transacción.</p>
              </div>
              <button className="sa-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={19} /></button>
            </div>

            {error && <div className="sa-form-error">{error}</div>}

            <form onSubmit={submitCreate}>
              <div className="sa-form-grid">
                <div><label className="sa-label">Nombre comercial *</label><input className="sa-input" name="name" required placeholder="Ej. Centro Vital" /></div>
                <div><label className="sa-label">Subdominio / slug *</label><div className="sa-inline-domain"><input className="sa-input" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="centro-vital" /><span className="sa-domain-suffix">.nanoapps.ar</span></div></div>
                <div><label className="sa-label">Fecha de inicio *</label><input className="sa-input" name="membershipStart" type="date" required defaultValue={defaultStart} /></div>
                <div><label className="sa-label">Fecha de vencimiento *</label><input className="sa-input" name="membershipEnd" type="date" required defaultValue={defaultEnd} /></div>
                <div><label className="sa-label">Estado inicial *</label><select className="sa-select" name="initialStatus" defaultValue="TRIAL"><option value="TRIAL">Período de prueba</option><option value="ACTIVE">Activo / abonado</option></select></div>
                <div><label className="sa-label">Plan SaaS *</label><select className="sa-select" name="planId" required defaultValue={plans[0]?.id}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {money.format(plan.priceCents / 100)}/mes</option>)}</select></div>
              </div>

              <div className="sa-form-section">
                <h3 className="sa-form-section-title">Usuario administrador inicial del tenant</h3>
                <div className="sa-form-grid">
                  <div><label className="sa-label">Nombre completo *</label><input className="sa-input" name="ownerName" required placeholder="Responsable del negocio" /></div>
                  <div><label className="sa-label">Email *</label><input className="sa-input" name="ownerEmail" type="email" required placeholder="admin@negocio.com" /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label className="sa-label">Contraseña inicial *</label><input className="sa-input" name="password" type="password" minLength={10} required placeholder="Mínimo 10 caracteres" /></div>
                </div>
              </div>

              <div className="sa-form-actions">
                <button className="sa-secondary-button" type="button" onClick={() => setOpen(false)}>Cancelar</button>
                <button className="sa-primary-button" disabled={pending}>{pending ? "Aprovisionando..." : "Crear empresa"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

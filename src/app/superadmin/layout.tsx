import Link from "next/link";
import { Building2, CheckCircle2, Layers3, LayoutDashboard, LogOut, Shield } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // /superadmin/login debe renderizarse sin la consola autenticada.
  if (!session?.user.isSuperAdmin || session.tenantId) return children;

  return (
    <div className="sa-shell">
      <header className="sa-header">
        <div className="sa-header-left">
          <Link href="/superadmin" className="sa-brand" aria-label="OnlyTurn SuperAdmin">
            <span className="sa-brand-icon"><Shield size={19} /></span>
            <span className="sa-brand-copy">
              <strong>OnlyTurn</strong>
              <small>SuperAdmin</small>
            </span>
          </Link>

          <nav className="sa-nav" aria-label="Navegación SuperAdmin">
            <Link href="/superadmin"><LayoutDashboard size={16} /> Métricas</Link>
            <Link href="/superadmin/tenants"><Building2 size={16} /> Empresas / Tenants</Link>
            <Link href="/superadmin/planes"><Layers3 size={16} /> Planes SaaS</Link>
          </nav>
        </div>

        <div className="sa-header-actions">
          <span className="sa-server-status"><CheckCircle2 size={14} /> Plataforma operativa</span>
          <div className="sa-admin-identity">
            <strong>{session.user.name}</strong>
            <small>NanoLabs</small>
          </div>
          <form action={logoutAction}>
            <button className="sa-logout" type="submit"><LogOut size={14} /> Salir</button>
          </form>
        </div>
      </header>

      <main className="sa-content">{children}</main>
    </div>
  );
}

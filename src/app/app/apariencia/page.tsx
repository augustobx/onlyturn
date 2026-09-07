import Link from "next/link";
import { Image as ImageIcon, Palette } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import type { PublicBranding } from "@/lib/public-themes";
import { ThemeCustomizer } from "./theme-customizer";

export default async function AppearancePage() {
  const { tenant } = await requireTenantSession();
  const branding = tenant.branding as PublicBranding;

  return <>
    <div className="page-title appearance-page-title">
      <span className="eyebrow">Experiencia pública</span>
      <div className="appearance-title-row">
        <div><h1>Apariencia PWA</h1><p className="muted">Personalizá la aplicación de reservas de este negocio sin modificar el panel administrativo.</p></div>
        <Link className="button secondary" href="/configuracion"><ImageIcon size={16} /> Logo e imágenes</Link>
      </div>
    </div>

    <div className="appearance-intro card">
      <Palette size={20} />
      <div><strong>Identidad independiente por cliente</strong><p className="muted">Cada tenant puede usar un tema distinto. Los cambios afectan su PWA, colores del navegador y manifest instalable.</p></div>
    </div>

    <ThemeCustomizer
      tenantName={tenant.name}
      logoUrl={branding.logoUrl}
      coverUrl={branding.coverUrl ?? branding.splashUrl}
      currentThemeId={branding.themeId}
      currentPrimary={branding.primaryColor}
      currentSecondary={branding.secondaryColor}
    />
  </>;
}

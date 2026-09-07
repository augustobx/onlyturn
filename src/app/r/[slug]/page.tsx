/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicCatalog, getPublicExperience, getPublicTenant } from "@/lib/booking-service";
import { BookingWizard } from "./booking-wizard";
import { AnnouncementBoard } from "./announcement-board";
import { getCustomerSession } from "@/lib/customer-auth";
import { platformDb } from "@/lib/db";
import { getCustomerUsablePackages } from "@/lib/packages";
import { resolvePublicTheme, type PublicBranding } from "@/lib/public-themes";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return {};
  const branding = tenant.branding as PublicBranding;
  return {
    title: `Reservar en ${tenant.name}`,
    description: branding.description ?? `Reservá tu turno online en ${tenant.name}`,
    manifest: "/manifest.webmanifest",
    icons: branding.logoUrl ? { icon: branding.logoUrl } : { icon: "/icon.svg" },
  };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) {
    const ownedTenant = await platformDb.tenant.findFirst({ where: { slug, archivedAt: null }, select: { status: true } });
    if (ownedTenant && !["ACTIVE", "TRIAL"].includes(ownedTenant.status)) redirect("/suspendido");
    notFound();
  }

  const [[locations, services], experience, customerSession] = await Promise.all([
    getPublicCatalog(tenant.id),
    getPublicExperience(tenant.id),
    getCustomerSession(tenant.id),
  ]);
  const customerPackages = customerSession ? await getCustomerUsablePackages(tenant.id, customerSession.account.customerId) : [];
  const branding = tenant.branding as PublicBranding;
  const publicTheme = resolvePublicTheme(branding);
  const settings = tenant.settings as { cancellationHours?: number };

  return <main
    className="booking-page booking-page-v2"
    data-theme={publicTheme.id}
    data-theme-mode={publicTheme.dark ? "dark" : "light"}
    style={{
      "--brand": publicTheme.primary,
      "--public-secondary": publicTheme.secondary,
      "--public-bg": publicTheme.background,
      "--public-surface": publicTheme.surface,
      "--public-text": publicTheme.text,
      "--public-muted": publicTheme.muted,
      "--public-line": publicTheme.line,
      "--public-soft": publicTheme.soft,
      "--public-radius": `${publicTheme.radius}px`,
      "--public-shadow": publicTheme.shadow,
      "--public-hero-from": publicTheme.heroFrom,
      "--public-hero-to": publicTheme.heroTo,
      "--public-cover": branding.coverUrl ? `url(${branding.coverUrl})` : branding.splashUrl ? `url(${branding.splashUrl})` : "none",
    } as React.CSSProperties}
  >
    <AnnouncementBoard businessName={tenant.name} notices={experience.announcements.map((item) => ({ id: item.id, title: item.title, body: item.body, style: item.style }))} />
    <div className="public-hero"><div className="booking-wrap"><div className="public-brand-v2">
      {branding.logoUrl ? <img src={branding.logoUrl} alt={`Logo de ${tenant.name}`} /> : <div className="logo">{tenant.name[0]}</div>}
      <div><h1>{tenant.name}</h1><p>{branding.description ?? "Reservá tu turno en pocos minutos"}</p></div>
      <a className="public-account-link" href={customerSession ? "/mi-cuenta" : "/cuenta"}>{customerSession ? `Hola, ${customerSession.account.customer.firstName}` : "Ingresar / registrarme"}</a>
    </div></div></div>
    <div className="booking-wrap booking-content-v2">
      <BookingWizard
        slug={slug}
        currency={tenant.currency}
        timezone={tenant.timezone}
        cancellationHours={settings.cancellationHours ?? 12}
        locations={locations}
        services={services}
        packages={customerPackages.map((membership) => ({
          id: membership.id,
          name: membership.name,
          remainingUses: membership.remainingUses,
          expiresAt: membership.expiresAt?.toISOString() ?? null,
          serviceIds: membership.package.services.map((link) => link.serviceId),
        }))}
        customer={customerSession ? {
          firstName: customerSession.account.customer.firstName,
          lastName: customerSession.account.customer.lastName ?? "",
          phone: customerSession.account.customer.phone,
          email: customerSession.account.email,
        } : undefined}
      />
      {experience.gallery.length > 0 && <section className="public-gallery"><h2>Conocé nuestro espacio</h2><div>{experience.gallery.map((item) => <img src={item.publicUrl} alt={item.altText ?? tenant.name} key={item.id} />)}</div></section>}
      <p className="muted" style={{ textAlign: "center", fontSize: 11, marginTop: 22 }}>Agenda gestionada con <strong>OnlyTurn</strong> · NanoLabs</p>
    </div>
  </main>;
}

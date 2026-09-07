"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import type { CustomFieldType, Prisma } from "@prisma/client";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTenantDb } from "@/lib/tenant-db";
import { uploadTenantImage } from "@/lib/r2";
import { encryptPaymentCredentials } from "@/lib/payment-crypto";
import { effectiveFeatures } from "@/lib/plans";
import { clearTenantResolutionCache, normalizeHostname } from "@/lib/tenant-context";
import {
  cancelAvailabilityException,
  disconnectPaymentProvider,
  setAnnouncementActive,
  setCustomFieldActive,
  setMediaAssetActive,
  updateAnnouncement,
  updateCustomField,
  updateMediaAssetAltText,
} from "@/lib/settings-management";

const authorize = async () => {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "settings:manage")) throw new Error("Forbidden");
  return context;
};

const keyFrom = (label: string) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

function refreshSettings(slug?: string) {
  revalidatePath("/app/configuracion");
  revalidatePath("/configuracion");
  revalidatePath("/app/configurar");
  revalidatePath("/configurar");
  if (slug) {
    revalidatePath(`/r/${slug}`);
    revalidatePath(`/r/${slug}/registro`);
    revalidatePath(`/r/${slug}/cuenta`);
  }
}

export async function updateSettingsAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const input = z.object({
    intervalMinutes: z.coerce.number().int().min(5).max(240),
    minimumNoticeMinutes: z.coerce.number().int().min(0).max(525600),
    maximumAdvanceDays: z.coerce.number().int().min(1).max(730),
    cancellationHours: z.coerce.number().int().min(0).max(720),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    description: z.string().trim().max(300),
    phone: z.string().trim().max(40),
  }).parse(Object.fromEntries(formData));
  const currentSettings = tenant.settings as Record<string, unknown>;
  const currentBranding = tenant.branding as Record<string, unknown>;
  await createTenantDb(membership.tenantId).updateSettings({
    settings: { ...currentSettings, intervalMinutes: input.intervalMinutes, minimumNoticeMinutes: input.minimumNoticeMinutes, maximumAdvanceDays: input.maximumAdvanceDays, cancellationHours: input.cancellationHours },
    branding: { ...currentBranding, primaryColor: input.primaryColor, description: input.description, phone: input.phone },
  }, session.userId);
  refreshSettings(tenant.slug);
}

export async function updateCustomerAccessSettingsAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const input = z.object({
    customerAccessTitle: z.string().trim().min(3).max(120).optional(),
    customerAccessMessage: z.string().trim().min(10).max(700).optional(),
    customerPendingTitle: z.string().trim().min(3).max(120).optional(),
    customerPendingMessage: z.string().trim().min(10).max(700).optional(),
  }).parse(Object.fromEntries(formData));
  const currentSettings = tenant.settings as Record<string, unknown>;
  const text = (key: string, fallback: string) => typeof currentSettings[key] === "string" && String(currentSettings[key]).trim() ? String(currentSettings[key]) : fallback;
  await createTenantDb(membership.tenantId).updateSettings({
    settings: {
      ...currentSettings,
      customerRegistrationEnabled: formData.get("customerRegistrationEnabled") === "on",
      customerApprovalRequired: formData.get("customerApprovalRequired") === "on",
      customerAccessTitle: input.customerAccessTitle ?? text("customerAccessTitle", "Para acceder a nuestros servicios necesitás una cuenta"),
      customerAccessMessage: input.customerAccessMessage ?? text("customerAccessMessage", "Registrate una sola vez. Después vas a poder ver los servicios disponibles, reservar horarios y administrar tus turnos desde tu cuenta."),
      customerPendingTitle: input.customerPendingTitle ?? text("customerPendingTitle", "Tu cuenta está en verificación"),
      customerPendingMessage: input.customerPendingMessage ?? text("customerPendingMessage", `Recibimos tu registro correctamente. El equipo de ${tenant.name} va a revisar tus datos y, en breve, tu cuenta quedará habilitada para acceder a los servicios y gestionar tus reservas.`),
    },
    branding: tenant.branding as Prisma.InputJsonObject,
  }, session.userId);
  refreshSettings(tenant.slug);
}

const customFieldSchema = z.object({
  fieldId: z.string().optional(),
  serviceId: z.string().optional(),
  label: z.string().trim().min(2).max(100),
  type: z.enum(["TEXT", "NUMBER", "PHONE", "EMAIL", "DATE", "SELECT", "MULTI_SELECT", "CHECKBOX", "TEXTAREA"]),
  options: z.string().trim().max(1000).optional(),
});

function parseCustomField(formData: FormData) {
  const input = customFieldSchema.parse(Object.fromEntries(formData));
  const options = input.options?.split(",").map((value) => value.trim()).filter(Boolean);
  return {
    ...input,
    required: formData.has("required"),
    appliesToCustomer: formData.has("appliesToCustomer"),
    options: options?.length ? options : undefined,
  };
}

export async function createCustomFieldAction(formData: FormData) {
  const { session, membership } = await authorize();
  const input = parseCustomField(formData);
  await createTenantDb(membership.tenantId).createCustomField({
    serviceId: input.serviceId || undefined,
    key: keyFrom(input.label),
    label: input.label,
    type: input.type as CustomFieldType,
    required: input.required,
    appliesToCustomer: input.appliesToCustomer,
    options: input.options,
  }, session.userId);
  refreshSettings();
}

export async function updateCustomFieldAction(formData: FormData) {
  const { session, membership } = await authorize();
  const input = parseCustomField(formData);
  if (!input.fieldId) throw new Error("Campo requerido");
  await updateCustomField(membership.tenantId, input.fieldId, {
    serviceId: input.serviceId || undefined,
    label: input.label,
    type: input.type as CustomFieldType,
    required: input.required,
    appliesToCustomer: input.appliesToCustomer,
    options: input.options,
  }, session.userId);
  refreshSettings();
}

export async function setCustomFieldActiveAction(formData: FormData) {
  const { session, membership } = await authorize();
  const input = z.object({ fieldId: z.string().min(1), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await setCustomFieldActive(membership.tenantId, input.fieldId, input.active === "true", session.userId);
  refreshSettings();
}

export async function createExceptionAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const input = z.object({ target: z.string(), startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), reason: z.string().trim().max(200).optional() }).parse(Object.fromEntries(formData));
  const [kind, id] = input.target.split(":");
  await createTenantDb(membership.tenantId).createException({
    startsAt: fromZonedTime(input.startsAt, tenant.timezone),
    endsAt: fromZonedTime(input.endsAt, tenant.timezone),
    reason: input.reason,
    ...(kind === "location" ? { locationId: id } : kind === "professional" ? { professionalId: id } : kind === "resource" ? { resourceId: id } : {}),
  }, session.userId);
  refreshSettings();
}

export async function cancelExceptionAction(formData: FormData) {
  const { session, membership } = await authorize();
  const exceptionId = z.string().min(1).parse(formData.get("exceptionId"));
  await cancelAvailabilityException(membership.tenantId, exceptionId, session.userId);
  refreshSettings();
}

export async function uploadMediaAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const kind = z.enum(["LOGO", "COVER", "SPLASH", "GALLERY"]).parse(formData.get("kind"));
  const altText = z.string().trim().max(120).optional().parse(formData.get("altText") || undefined);
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Seleccioná una imagen");
  const uploaded = await uploadTenantImage(membership.tenantId, kind, file);
  const db = createTenantDb(membership.tenantId);
  await db.createMediaAsset({ ...uploaded, kind, altText }, session.userId);
  if (kind !== "GALLERY") {
    const branding = { ...(tenant.branding as Record<string, unknown>), [`${kind.toLowerCase()}Url`]: uploaded.publicUrl };
    await db.updateSettings({ settings: tenant.settings as Prisma.InputJsonObject, branding: branding as Prisma.InputJsonObject }, session.userId);
  }
  refreshSettings(tenant.slug);
}

export async function updateMediaAssetAction(formData: FormData) {
  const { session, membership } = await authorize();
  const input = z.object({ assetId: z.string().min(1), altText: z.string().trim().max(120).optional() }).parse(Object.fromEntries(formData));
  await updateMediaAssetAltText(membership.tenantId, input.assetId, input.altText || undefined, session.userId);
  refreshSettings();
}

export async function setMediaAssetActiveAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const input = z.object({ assetId: z.string().min(1), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await setMediaAssetActive(membership.tenantId, input.assetId, input.active === "true", session.userId);
  refreshSettings(tenant.slug);
}

const announcementSchema = z.object({
  announcementId: z.string().optional(),
  title: z.string().trim().min(2).max(100),
  body: z.string().trim().min(2).max(400),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endsAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), z.literal("")]),
  style: z.enum(["INFO", "SUCCESS", "WARNING"]),
});

export async function createAnnouncementAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const input = announcementSchema.parse(Object.fromEntries(formData));
  await createTenantDb(membership.tenantId).createAnnouncement({
    title: input.title,
    body: input.body,
    style: input.style,
    startsAt: fromZonedTime(input.startsAt, tenant.timezone),
    endsAt: input.endsAt ? fromZonedTime(input.endsAt, tenant.timezone) : undefined,
  }, session.userId);
  refreshSettings(tenant.slug);
}

export async function updateAnnouncementAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const input = announcementSchema.parse(Object.fromEntries(formData));
  if (!input.announcementId) throw new Error("Anuncio requerido");
  await updateAnnouncement(membership.tenantId, input.announcementId, {
    title: input.title,
    body: input.body,
    style: input.style,
    startsAt: fromZonedTime(input.startsAt, tenant.timezone),
    endsAt: input.endsAt ? fromZonedTime(input.endsAt, tenant.timezone) : undefined,
  }, session.userId);
  refreshSettings(tenant.slug);
}

export async function setAnnouncementActiveAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const input = z.object({ announcementId: z.string().min(1), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await setAnnouncementActive(membership.tenantId, input.announcementId, input.active === "true", session.userId);
  refreshSettings(tenant.slug);
}

export async function saveMercadoPagoAction(formData: FormData) {
  const { session, membership } = await authorize();
  const features = await effectiveFeatures(membership.tenantId);
  if (!features.deposits) throw new Error("Tu plan no incluye cobros online");
  const input = z.object({ accessToken: z.string().trim().min(20).max(1000), publicKey: z.string().trim().min(10).max(1000), displayName: z.string().trim().max(80).optional() }).parse(Object.fromEntries(formData));
  const encryptedCredentials = encryptPaymentCredentials({ accessToken: input.accessToken, publicKey: input.publicKey });
  await createTenantDb(membership.tenantId).savePaymentConnection({ encryptedCredentials, displayName: input.displayName || "Mercado Pago" }, session.userId);
  refreshSettings();
}

export async function disconnectMercadoPagoAction() {
  const { session, membership } = await authorize();
  await disconnectPaymentProvider(membership.tenantId, session.userId);
  refreshSettings();
}

export async function updateServicePaymentPolicyAction(formData: FormData) {
  const { session, membership, tenant } = await authorize();
  const features = await effectiveFeatures(membership.tenantId);
  if (!features.deposits) throw new Error("Tu plan no incluye cobros online");
  const input = z.object({ serviceId: z.string().min(1), mode: z.enum(["NONE", "DEPOSIT", "FULL"]), percent: z.coerce.number().int().min(1).max(100), holdMinutes: z.coerce.number().int().min(5).max(120) }).parse(Object.fromEntries(formData));
  if (input.mode !== "NONE") {
    const [connection] = await createTenantDb(membership.tenantId).paymentData();
    if (!connection) throw new Error("Conectá Mercado Pago antes de activar cobros");
  }
  const policy = { enabled: input.mode !== "NONE", mode: input.mode, percent: input.mode === "FULL" ? 100 : input.percent, holdMinutes: input.holdMinutes, currency: tenant.currency, provider: "MERCADOPAGO" };
  await createTenantDb(membership.tenantId).updateServiceDeposit(input.serviceId, policy, session.userId);
  refreshSettings(tenant.slug);
}

export async function createCustomDomainAction(formData: FormData) {
  const { session, membership } = await authorize();
  const features = await effectiveFeatures(membership.tenantId);
  if (!features.customDomain) throw new Error("Tu plan actual no incluye dominio propio");
  const rawHostname = z.string().trim().min(3).max(120).parse(formData.get("hostname"));
  const hostname = normalizeHostname(rawHostname);
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(hostname)) throw new Error("Formato de dominio inválido (ejemplo: turnos.tudominio.com)");
  await createTenantDb(membership.tenantId).createCustomDomain(hostname, session.userId);
  clearTenantResolutionCache();
  refreshSettings();
}

export async function deleteCustomDomainAction(formData: FormData) {
  const { session, membership } = await authorize();
  const features = await effectiveFeatures(membership.tenantId);
  if (!features.customDomain) throw new Error("Tu plan actual no incluye dominio propio");
  const id = z.string().min(1).parse(formData.get("id"));
  await createTenantDb(membership.tenantId).deleteCustomDomain(id, session.userId);
  clearTenantResolutionCache();
  refreshSettings();
}

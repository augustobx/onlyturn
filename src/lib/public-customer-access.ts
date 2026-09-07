import "server-only";

import { getCustomerSession } from "./customer-auth";

type TenantCustomerAccess = {
  id: string;
  settings: unknown;
};

export function customerRegistrationIsRequired(settings: unknown) {
  return Boolean((settings as { customerRegistrationEnabled?: boolean } | null)?.customerRegistrationEnabled);
}

export async function assertPublicCustomerAccess(tenant: TenantCustomerAccess) {
  if (!customerRegistrationIsRequired(tenant.settings)) return null;
  const session = await getCustomerSession(tenant.id);
  if (!session) throw new Error("Necesitás registrarte e ingresar a tu cuenta antes de acceder a los servicios.");
  return session;
}

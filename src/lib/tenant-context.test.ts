import { describe, expect, it } from "vitest";
import { isPlatformHostname, normalizeHostname } from "./tenant-context";
import { tenantPublicUrl, tenantSlugFromHostname } from "./hostnames";

describe("tenant-context", () => {
  it("normalizes hostnames by stripping ports, trailing dots and casing", () => {
    expect(normalizeHostname("ONLYTURN.NANOAPPS.AR:3000")).toBe("onlyturn.nanoapps.ar");
    expect(normalizeHostname("  centro-demo.nanoapps.ar.  ")).toBe("centro-demo.nanoapps.ar");
    expect(normalizeHostname("localhost:3000")).toBe("localhost");
  });

  it("identifies platform hostnames correctly", () => {
    expect(isPlatformHostname("onlyturn.nanoapps.ar")).toBe(true);
    expect(isPlatformHostname("localhost")).toBe(true);
    expect(isPlatformHostname("127.0.0.1")).toBe(true);
    expect(isPlatformHostname("127.0.0.1:3000")).toBe(true);
    expect(isPlatformHostname("centro-demo.nanoapps.ar")).toBe(false);
    expect(isPlatformHostname("turnos.micentro.com")).toBe(false);
  });

  it("uses the shared NanoApps namespace for tenants", () => {
    expect(tenantSlugFromHostname("centro-demo.nanoapps.ar")).toBe("centro-demo");
    expect(tenantSlugFromHostname("onlyturn.nanoapps.ar")).toBeNull();
    expect(tenantSlugFromHostname("centro.onlyturn.nanoapps.ar")).toBeNull();
    expect(tenantPublicUrl("centro-demo")).toBe("https://centro-demo.nanoapps.ar");
  });
});

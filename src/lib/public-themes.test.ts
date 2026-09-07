import { describe, expect, it } from "vitest";
import { defaultPublicTheme, publicThemes, resolvePublicTheme } from "./public-themes";

describe("public PWA themes", () => {
  it("ships at least six unique professional presets", () => {
    expect(publicThemes.length).toBeGreaterThanOrEqual(6);
    expect(new Set(publicThemes.map((theme) => theme.id)).size).toBe(publicThemes.length);
  });

  it("falls back to the default preset", () => {
    expect(resolvePublicTheme({}).id).toBe(defaultPublicTheme.id);
    expect(resolvePublicTheme({ themeId: "unknown" }).id).toBe(defaultPublicTheme.id);
  });

  it("applies tenant color overrides without mutating the preset", () => {
    const originalPrimary = publicThemes[0].primary;
    const resolved = resolvePublicTheme({ themeId: publicThemes[0].id, primaryColor: "#112233", secondaryColor: "#445566" });
    expect(resolved.primary).toBe("#112233");
    expect(resolved.secondary).toBe("#445566");
    expect(publicThemes[0].primary).toBe(originalPrimary);
  });
});

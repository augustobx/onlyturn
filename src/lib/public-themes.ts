export type PublicTheme = {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  soft: string;
  heroFrom: string;
  heroTo: string;
  radius: number;
  shadow: string;
  dark: boolean;
};

export const publicThemes: PublicTheme[] = [
  { id: "nano-blue", name: "Nano Blue", description: "Limpio, moderno y tecnológico. Ideal para la mayoría de los negocios.", primary: "#2563eb", secondary: "#0ea5e9", background: "#f4f7fb", surface: "#ffffff", text: "#0f172a", muted: "#64748b", line: "#e2e8f0", soft: "#eaf2ff", heroFrom: "#0b2455", heroTo: "#2563eb", radius: 18, shadow: "0 18px 55px rgba(15,23,42,.10)", dark: false },
  { id: "graphite-premium", name: "Graphite Premium", description: "Oscuro y sofisticado para marcas premium, barberías, estudios y servicios exclusivos.", primary: "#d4af37", secondary: "#f3d46b", background: "#0a0b0d", surface: "#14161a", text: "#f8fafc", muted: "#a1a1aa", line: "#292c33", soft: "#211f17", heroFrom: "#08090b", heroTo: "#27231a", radius: 14, shadow: "0 20px 60px rgba(0,0,0,.34)", dark: true },
  { id: "sage-wellness", name: "Sage Wellness", description: "Natural y relajado para wellness, masajes, yoga, estética y terapias.", primary: "#5f7f6f", secondary: "#9bb6a5", background: "#f5f7f3", surface: "#fffefb", text: "#24322b", muted: "#718078", line: "#dfe7df", soft: "#e8efe9", heroFrom: "#3f5f50", heroTo: "#7d9a89", radius: 22, shadow: "0 18px 48px rgba(45,67,55,.12)", dark: false },
  { id: "blush-beauty", name: "Blush Beauty", description: "Suave y elegante para peluquerías, uñas, maquillaje, spa y belleza.", primary: "#c65b7c", secondary: "#eaa6b8", background: "#fff7f9", surface: "#ffffff", text: "#3d2029", muted: "#8b6872", line: "#f2dfe5", soft: "#fdeaf0", heroFrom: "#9f3f5f", heroTo: "#dd8da7", radius: 24, shadow: "0 18px 52px rgba(160,63,96,.14)", dark: false },
  { id: "teal-health", name: "Teal Health", description: "Profesional y confiable para salud, consultorios, odontología y centros médicos.", primary: "#0f8b8d", secondary: "#2bb8ad", background: "#f2fbfa", surface: "#ffffff", text: "#123637", muted: "#5f7777", line: "#d8ecea", soft: "#e0f6f3", heroFrom: "#0b6265", heroTo: "#19a7a4", radius: 16, shadow: "0 18px 50px rgba(15,139,141,.12)", dark: false },
  { id: "violet-studio", name: "Violet Studio", description: "Creativo y contemporáneo para estudios, academias, coaching y profesionales independientes.", primary: "#6d4aff", secondary: "#9b79ff", background: "#f7f5ff", surface: "#ffffff", text: "#201a38", muted: "#746d8a", line: "#e5e0f3", soft: "#eee9ff", heroFrom: "#3f2a88", heroTo: "#7a5cf0", radius: 20, shadow: "0 18px 55px rgba(77,56,150,.14)", dark: false },
  { id: "amber-warm", name: "Amber Warm", description: "Cálido y cercano para gastronomía, mascotas, talleres y negocios familiares.", primary: "#c77718", secondary: "#eda646", background: "#fff9f0", surface: "#fffdf9", text: "#402d18", muted: "#826d55", line: "#f0dfc9", soft: "#fff0d8", heroFrom: "#8b4b12", heroTo: "#d99135", radius: 18, shadow: "0 18px 52px rgba(139,75,18,.13)", dark: false },
  { id: "slate-corporate", name: "Slate Corporate", description: "Sobrio y ejecutivo para estudios, oficinas, consultoras y servicios B2B.", primary: "#334155", secondary: "#64748b", background: "#f1f5f9", surface: "#ffffff", text: "#0f172a", muted: "#64748b", line: "#d8e0e9", soft: "#e7edf3", heroFrom: "#172033", heroTo: "#475569", radius: 12, shadow: "0 15px 44px rgba(15,23,42,.10)", dark: false },
];

export const defaultPublicTheme = publicThemes[0];

export function getPublicTheme(themeId?: string | null) {
  return publicThemes.find((theme) => theme.id === themeId) ?? defaultPublicTheme;
}

export type PublicBranding = {
  themeId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  description?: string;
  phone?: string;
  logoUrl?: string;
  coverUrl?: string;
  splashUrl?: string;
};

export function resolvePublicTheme(branding: PublicBranding) {
  const preset = getPublicTheme(branding.themeId);
  return { ...preset, primary: branding.primaryColor ?? preset.primary, secondary: branding.secondaryColor ?? preset.secondary };
}

export function publicThemeVariables(branding: PublicBranding) {
  const theme = resolvePublicTheme(branding);
  return {
    theme,
    style: {
      "--brand": theme.primary,
      "--public-secondary": theme.secondary,
      "--public-bg": theme.background,
      "--public-surface": theme.surface,
      "--public-text": theme.text,
      "--public-muted": theme.muted,
      "--public-line": theme.line,
      "--public-soft": theme.soft,
      "--public-radius": `${theme.radius}px`,
      "--public-shadow": theme.shadow,
      "--public-hero-from": theme.heroFrom,
      "--public-hero-to": theme.heroTo,
      "--public-cover": branding.coverUrl ? `url(${branding.coverUrl})` : branding.splashUrl ? `url(${branding.splashUrl})` : "none",
    } as Record<string, string>,
  };
}

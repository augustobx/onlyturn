import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./nanolabs.css";
import "./admin-ux.css";
import { PwaRegister } from "@/components/pwa-register";

const baseUrl = process.env.APP_BASE_URL || "https://onlyturn.nanoapps.ar";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: "OnlyTurn · NanoLabs", template: "%s · OnlyTurn" },
  description: "Gestión profesional de turnos, reservas, clientes, profesionales y recursos.",
  applicationName: "OnlyTurn",
  creator: "NanoLabs",
  publisher: "NanoLabs",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "OnlyTurn · NanoLabs",
    title: "OnlyTurn · NanoLabs",
    description: "Turnos y reservas para negocios que necesitan una agenda simple, profesional y escalable.",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR"><body>{children}<PwaRegister /></body></html>;
}

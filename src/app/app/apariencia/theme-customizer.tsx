/* eslint-disable @next/next/no-img-element */
"use client";

import { Check, Palette, RotateCcw, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { updateAppearanceAction } from "@/app/actions/appearance";
import { getPublicTheme, publicThemes } from "@/lib/public-themes";
import { FeedbackForm } from "@/components/feedback-form";

type Props = {
  tenantName: string;
  logoUrl?: string;
  coverUrl?: string;
  currentThemeId?: string;
  currentPrimary?: string;
  currentSecondary?: string;
};

export function ThemeCustomizer({ tenantName, logoUrl, coverUrl, currentThemeId, currentPrimary, currentSecondary }: Props) {
  const initialTheme = getPublicTheme(currentThemeId);
  const [themeId, setThemeId] = useState(initialTheme.id);
  const [primary, setPrimary] = useState(currentPrimary ?? initialTheme.primary);
  const [secondary, setSecondary] = useState(currentSecondary ?? initialTheme.secondary);
  const theme = useMemo(() => getPublicTheme(themeId), [themeId]);

  function chooseTheme(id: string) {
    const next = getPublicTheme(id);
    setThemeId(next.id);
    setPrimary(next.primary);
    setSecondary(next.secondary);
  }
  function resetColors() { setPrimary(theme.primary); setSecondary(theme.secondary); }

  const previewStyle = {
    "--preview-primary": primary,
    "--preview-secondary": secondary,
    "--preview-bg": theme.background,
    "--preview-surface": theme.surface,
    "--preview-text": theme.text,
    "--preview-muted": theme.muted,
    "--preview-line": theme.line,
    "--preview-soft": theme.soft,
    "--preview-hero-from": theme.heroFrom,
    "--preview-hero-to": theme.heroTo,
    "--preview-radius": `${theme.radius}px`,
  } as React.CSSProperties;

  return <FeedbackForm action={updateAppearanceAction} className="appearance-layout" savedMessage="Apariencia guardada">
    <input type="hidden" name="themeId" value={themeId} />
    <section className="appearance-editor">
      <div className="card appearance-section">
        <div className="section-head"><div><span className="eyebrow">Temas</span><h2>Elegí una identidad visual</h2></div><Palette size={20} /></div>
        <p className="muted">Cada preset modifica fondo, superficies, contraste, hero, radios, sombras y paleta. Después podés ajustar los colores principales.</p>
        <div className="theme-grid">
          {publicThemes.map((item) => {
            const selected = item.id === themeId;
            return <button type="button" className={`theme-card ${selected ? "selected" : ""}`} onClick={() => chooseTheme(item.id)} key={item.id} aria-pressed={selected}>
              <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${item.primary}, ${item.secondary})` }}>{selected && <Check size={16} />}</span>
              <span className="theme-card-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
              <span className="theme-dots"><i style={{ background: item.primary }} /><i style={{ background: item.secondary }} /><i style={{ background: item.background }} /></span>
            </button>;
          })}
        </div>
      </div>

      <div className="card appearance-section">
        <div className="section-head"><div><span className="eyebrow">Marca</span><h2>Ajustes del tema</h2></div></div>
        <div className="appearance-colors">
          <label className="color-control"><span>Color principal</span><div><input name="primaryColor" type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} /><code>{primary.toUpperCase()}</code></div></label>
          <label className="color-control"><span>Color secundario</span><div><input name="secondaryColor" type="color" value={secondary} onChange={(event) => setSecondary(event.target.value)} /><code>{secondary.toUpperCase()}</code></div></label>
        </div>
        <button className="button ghost appearance-reset" type="button" onClick={resetColors}><RotateCcw size={15} /> Restaurar colores del preset</button>
        <p className="muted" style={{ fontSize: 12 }}>Logo, portada, splash y galería se siguen administrando en Configuración → Imágenes.</p>
      </div>

      <div className="appearance-savebar"><div><strong>{theme.name}</strong><span className="muted">La PWA pública cambia para este tenant únicamente.</span></div><button className="button" type="submit">Guardar apariencia</button></div>
    </section>

    <aside className="appearance-preview-wrap">
      <div className="appearance-preview-label"><Smartphone size={16} /><span>Vista previa</span></div>
      <div className={`pwa-phone-preview ${theme.dark ? "is-dark" : ""}`} style={previewStyle}>
        <div className="pwa-preview-screen">
          <div className="pwa-preview-hero" style={coverUrl ? { backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${primary} 82%, transparent), color-mix(in srgb, ${secondary} 72%, transparent)), url(${coverUrl})` } : undefined}>
            <div className="pwa-preview-brand">{logoUrl ? <img src={logoUrl} alt="" /> : <span>{tenantName.charAt(0).toUpperCase()}</span>}<div><strong>{tenantName}</strong><small>Reservá tu turno online</small></div></div>
          </div>
          <div className="pwa-preview-content">
            <div className="pwa-preview-card"><span className="pwa-preview-step">1</span><div><strong>Elegí un servicio</strong><small>Seleccioná la opción que necesitás</small></div></div>
            <div className="pwa-preview-options"><div><i /><span><strong>Servicio principal</strong><small>45 min</small></span><b>$ 18.000</b></div><div><i /><span><strong>Consulta breve</strong><small>30 min</small></span><b>$ 12.000</b></div></div>
            <div className="pwa-preview-card compact"><span className="pwa-preview-step">2</span><div><strong>Elegí día y horario</strong><small>Próximos turnos disponibles</small></div></div>
            <div className="pwa-preview-slots"><span>09:00</span><span className="active">10:30</span><span>12:00</span></div>
            <button type="button">Continuar</button>
          </div>
        </div>
      </div>
    </aside>
  </FeedbackForm>;
}

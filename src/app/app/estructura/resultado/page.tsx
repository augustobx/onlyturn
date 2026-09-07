import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";

type ResultPageProps = {
  searchParams: Promise<{ status?: string; message?: string }>;
};

export default async function StructureActionResultPage({ searchParams }: ResultPageProps) {
  await requireTenantSession();
  const params = await searchParams;
  const isError = params.status !== "success";
  const message = params.message?.trim() || (isError ? "No se pudo completar la operación." : "Operación completada correctamente.");

  return (
    <div style={{ maxWidth: 720, margin: "32px auto" }}>
      <div
        className="card"
        role={isError ? "alert" : "status"}
        style={{
          padding: 28,
          borderColor: isError ? "#fecaca" : "#bbf7d0",
          background: isError ? "#fff7f7" : "#f0fdf4",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          {isError ? <AlertTriangle size={24} color="#b42331" /> : <CheckCircle2 size={24} color="#15803d" />}
          <div style={{ minWidth: 0 }}>
            <span className="eyebrow">Sedes y equipo</span>
            <h1 style={{ margin: "5px 0 8px" }}>{isError ? "No se pudo completar" : "Cambio guardado"}</h1>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{message}</p>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <Link className="button" href="/estructura">Volver a Sedes y equipo</Link>
        </div>
      </div>
    </div>
  );
}

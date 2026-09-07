"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";

type ServerFormAction = (formData: FormData) => Promise<unknown>;
type FeedbackState = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

export function FeedbackForm({
  action,
  children,
  className,
  savedMessage = "Cambios guardados",
}: {
  action: ServerFormAction;
  children: React.ReactNode;
  className?: string;
  savedMessage?: string;
}) {
  const [state, setState] = useState<FeedbackState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState({ kind: "saving" });
    startTransition(async () => {
      try {
        await action(formData);
        setState({ kind: "saved", message: savedMessage });
        window.setTimeout(() => setState((current) => current.kind === "saved" ? { kind: "idle" } : current), 2600);
      } catch (error) {
        setState({ kind: "error", message: error instanceof Error ? error.message : "No se pudo guardar el cambio." });
      }
    });
  }

  return <form className={className} onSubmit={submit} data-form-pending={pending ? "true" : "false"}>
    {children}
    {state.kind !== "idle" && <div className={`form-feedback ${state.kind}`} role="status" aria-live="polite">
      {state.kind === "saving" ? <LoaderCircle className="form-feedback-spinner" size={17} /> : state.kind === "saved" ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
      <span>{state.kind === "saving" ? "Guardando cambios…" : state.message}</span>
    </div>}
  </form>;
}

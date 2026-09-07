import "server-only";

import type { NotificationProvider, NotificationMessage, NotificationResult } from "./provider";

class ResendEmailProvider implements NotificationProvider {
  readonly channel = "EMAIL" as const;

  async send(message: NotificationMessage): Promise<NotificationResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATION_FROM_EMAIL;
    if (!apiKey || !from) throw new Error("Email provider not configured");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.recipient], subject: message.subject || "Notificación de reserva", text: message.text }),
    });
    const body = await response.json() as { id?: string; message?: string };
    if (!response.ok || !body.id) throw new Error(body.message || `Email provider error ${response.status}`);
    return { providerMessageId: body.id };
  }
}

class WhatsappProvider implements NotificationProvider {
  readonly channel = "WHATSAPP" as const;

  async send(message: NotificationMessage): Promise<NotificationResult> {
    const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.WHATSAPP_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}` } : {}),
        },
        body: JSON.stringify({ recipient: message.recipient, text: message.text, metadata: message.metadata ?? {} }),
      });
      if (!response.ok) throw new Error(`WhatsApp webhook error ${response.status}`);
      const body = await response.json().catch(() => ({})) as { id?: string; messageId?: string };
      return { providerMessageId: body.messageId || body.id || `webhook-${Date.now()}` };
    }

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION;
    if (!token || !phoneNumberId || !graphVersion) throw new Error("WhatsApp provider not configured");
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: message.recipient, type: "text", text: { body: message.text } }),
    });
    const body = await response.json() as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (!response.ok || !body.messages?.[0]?.id) throw new Error(body.error?.message || `WhatsApp provider error ${response.status}`);
    return { providerMessageId: body.messages[0].id };
  }
}

export function configuredNotificationProviders() {
  return {
    EMAIL: new ResendEmailProvider(),
    WHATSAPP: new WhatsappProvider(),
  } satisfies Partial<Record<"EMAIL" | "WHATSAPP", NotificationProvider>>;
}

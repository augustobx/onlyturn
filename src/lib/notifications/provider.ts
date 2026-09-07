import "server-only";
import type { NotificationChannel } from "@prisma/client";

export type NotificationMessage = { recipient: string; subject?: string; text: string; metadata?: Record<string, string> };
export type NotificationResult = { providerMessageId: string };

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<NotificationResult>;
}

export class NotificationRegistry {
  constructor(private readonly providers: Partial<Record<NotificationChannel, NotificationProvider>>) {}
  provider(channel: NotificationChannel) {
    const provider = this.providers[channel];
    if (!provider) throw new Error(`Notification channel not configured: ${channel}`);
    return provider;
  }
}

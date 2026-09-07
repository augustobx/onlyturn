"use server";
import { createPublicBooking } from "@/lib/public-booking";
export async function createPublicBookingAction(raw: unknown) { return createPublicBooking(raw); }

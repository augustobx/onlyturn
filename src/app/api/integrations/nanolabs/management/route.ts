import { managementHandlers } from "@/lib/hub-management-http";
import { turnManagement } from "@/lib/hub-management";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = managementHandlers(turnManagement);
export const GET = handlers.GET;
export const POST = handlers.POST;


"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTenantDb } from "@/lib/tenant-db";
import { signedLedgerAmountCents } from "@/lib/customer-accounts";

async function authorize(){const context=await requireTenantSession();if(!can(context.membership.role,context.membership.permissions,"customers:manage"))throw new Error("Forbidden");return context}

export async function updateCustomerAccountStatusAction(formData:FormData){const {membership,session}=await authorize();const input=z.object({customerId:z.string().min(1),status:z.enum(["ACTIVE","REJECTED","SUSPENDED"])}).parse(Object.fromEntries(formData));await createTenantDb(membership.tenantId).setCustomerAccountStatus(input.customerId,input.status,session.userId);revalidatePath("/app/clientes");revalidatePath(`/app/clientes/${input.customerId}`)}

export async function addCustomerLedgerEntryAction(formData:FormData){const {membership,session}=await authorize();const input=z.object({customerId:z.string().min(1),type:z.enum(["CHARGE","PAYMENT","CREDIT","ADJUSTMENT"]),amount:z.coerce.number().finite().refine(value=>value!==0),description:z.string().trim().min(2).max(200),bookingId:z.string().optional()}).parse(Object.fromEntries(formData));const amountCents=signedLedgerAmountCents(input.type,input.amount);await createTenantDb(membership.tenantId).addCustomerLedgerEntry(input.customerId,{type:input.type,amountCents,description:input.description,bookingId:input.bookingId||undefined},session.userId);revalidatePath(`/app/clientes/${input.customerId}`);revalidatePath("/app/clientes")}

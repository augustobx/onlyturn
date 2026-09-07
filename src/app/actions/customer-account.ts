"use server";
import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCustomerSession, destroyCustomerSession, requireCustomerSession } from "@/lib/customer-auth";
import { platformDb } from "@/lib/db";
import { getPublicTenant } from "@/lib/booking-service";
import { normalizeEmail, normalizePhone } from "@/lib/security";
import { customerRegistrationStatus } from "@/lib/customer-accounts";

export type CustomerAuthState={error?:string};
const credentials=z.object({slug:z.string().min(1),email:z.email(),password:z.string().min(8).max(200)});

export async function registerCustomerAction(_:CustomerAuthState,formData:FormData):Promise<CustomerAuthState>{
 const parsed=credentials.extend({firstName:z.string().trim().min(2).max(80),lastName:z.string().trim().max(80).optional(),phone:z.string().trim().min(6).max(30),confirmPassword:z.string()}).safeParse(Object.fromEntries(formData));
 if(!parsed.success||parsed.data.password!==parsed.data.confirmPassword)return{error:"Revisá los datos y asegurate de que las contraseñas coincidan."};
 const tenant=await getPublicTenant(parsed.data.slug);if(!tenant)return{error:"Agenda no disponible."};const settings=tenant.settings as {customerRegistrationEnabled?:boolean;customerApprovalRequired?:boolean};if(!settings.customerRegistrationEnabled)return{error:"El registro de clientes no está habilitado."};
 const normalizedEmail=normalizeEmail(parsed.data.email)!;const normalizedPhone=normalizePhone(parsed.data.phone);const passwordHash=await argon2.hash(parsed.data.password,{type:argon2.argon2id});const status=customerRegistrationStatus(Boolean(settings.customerApprovalRequired));
 try{
  const account=await platformDb.$transaction(async tx=>{
   const existing=await tx.customer.findUnique({where:{tenantId_normalizedPhone:{tenantId:tenant.id,normalizedPhone}},include:{account:true}});if(existing?.account)throw new Error("ACCOUNT_EXISTS");
   const customer=existing?await tx.customer.update({where:{id:existing.id},data:{firstName:parsed.data.firstName,lastName:parsed.data.lastName||null,email:parsed.data.email,normalizedEmail}}):await tx.customer.create({data:{tenantId:tenant.id,firstName:parsed.data.firstName,lastName:parsed.data.lastName||null,phone:parsed.data.phone,normalizedPhone,email:parsed.data.email,normalizedEmail}});
   const created=await tx.customerAccount.create({data:{tenantId:tenant.id,customerId:customer.id,email:parsed.data.email,normalizedEmail,passwordHash,status,approvedAt:status==="ACTIVE"?new Date():null}});
   await tx.auditLog.create({data:{scope:"TENANT",tenantId:tenant.id,action:"customer.account_registered",entityType:"CustomerAccount",entityId:created.id,metadata:{approvalRequired:Boolean(settings.customerApprovalRequired)}}});return created;
  });
  if(status==="ACTIVE"){await createCustomerSession(account.id,tenant.id);redirect("/mi-cuenta")}
  redirect("/cuenta?registered=pending");
 }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"||error instanceof Error&&error.message==="ACCOUNT_EXISTS")return{error:"Ya existe una cuenta con ese email o teléfono."};throw error}
}

export async function loginCustomerAction(_:CustomerAuthState,formData:FormData):Promise<CustomerAuthState>{
 const parsed=credentials.safeParse(Object.fromEntries(formData));if(!parsed.success)return{error:"Ingresá un email y contraseña válidos."};const tenant=await getPublicTenant(parsed.data.slug);if(!tenant)return{error:"Agenda no disponible."};const account=await platformDb.customerAccount.findUnique({where:{tenantId_normalizedEmail:{tenantId:tenant.id,normalizedEmail:normalizeEmail(parsed.data.email)!}}});if(!account||!await argon2.verify(account.passwordHash,parsed.data.password))return{error:"Email o contraseña incorrectos."};if(account.status==="PENDING")return{error:"Tu cuenta todavía está esperando aprobación."};if(account.status!=="ACTIVE")return{error:"Tu cuenta no está habilitada. Contactá al negocio."};await createCustomerSession(account.id,tenant.id);await platformDb.customerAccount.update({where:{id:account.id},data:{lastLoginAt:new Date()}});redirect("/mi-cuenta")
}

export async function updateCustomerProfileAction(formData:FormData){const input=z.object({slug:z.string(),firstName:z.string().trim().min(2).max(80),lastName:z.string().trim().max(80).optional(),document:z.string().trim().max(40).optional(),birthDate:z.string().optional()}).parse(Object.fromEntries(formData));const tenant=await getPublicTenant(input.slug);if(!tenant)throw new Error("Agenda no disponible");const session=await requireCustomerSession(tenant.id,tenant.slug);await platformDb.customer.update({where:{id:session.account.customerId},data:{firstName:input.firstName,lastName:input.lastName||null,document:input.document||null,birthDate:input.birthDate?new Date(`${input.birthDate}T12:00:00Z`):null}});revalidatePath(`/r/${tenant.slug}/mi-cuenta`);revalidatePath("/mi-cuenta")}

export async function logoutCustomerAction(formData:FormData){z.string().parse(formData.get("slug"));await destroyCustomerSession();redirect("/")}

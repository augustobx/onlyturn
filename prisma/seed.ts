import { PrismaClient, type BookingStatus } from "@prisma/client";
import argon2 from "argon2";
import { addDays, addMinutes, startOfDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
const db=new PrismaClient();

const features={
  BASIC:{maxLocations:1,maxStaff:3,maxResources:3,maxBookings:200,whatsappNotifications:false,advancedReports:false,customDomain:false,waitlist:false,deposits:false,recurringBookings:false},
  PRO:{maxLocations:3,maxStaff:15,maxResources:20,maxBookings:2000,whatsappNotifications:true,advancedReports:true,customDomain:false,waitlist:true,deposits:true,recurringBookings:true},
  BUSINESS:{maxLocations:20,maxStaff:100,maxResources:100,maxBookings:20000,whatsappNotifications:true,advancedReports:true,customDomain:true,waitlist:true,deposits:true,recurringBookings:true}
};
const timezone="America/Argentina/Buenos_Aires";
const localDate=(dayOffset:number)=>new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(addDays(new Date(),dayOffset));
const at=(dayOffset:number,hour:number,minute=0)=>fromZonedTime(`${localDate(dayOffset)}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00`,timezone);
async function ensureCustomerAccountDemo(tenantId:string,passwordHash:string){
 const activeCustomer=await db.customer.findFirst({where:{tenantId,normalizedEmail:"mateo@demo.test"}});const pendingCustomer=await db.customer.findFirst({where:{tenantId,normalizedEmail:"sofía@demo.test"}});
 if(activeCustomer)await db.customerAccount.upsert({where:{customerId:activeCustomer.id},update:{},create:{tenantId,customerId:activeCustomer.id,email:"mateo@demo.test",normalizedEmail:"mateo@demo.test",passwordHash,status:"ACTIVE",approvedAt:new Date()}});
 if(pendingCustomer)await db.customerAccount.upsert({where:{customerId:pendingCustomer.id},update:{},create:{tenantId,customerId:pendingCustomer.id,email:"sofía@demo.test",normalizedEmail:"sofía@demo.test",passwordHash,status:"PENDING"}});
 if(activeCustomer&&!await db.customerLedgerEntry.findFirst({where:{tenantId,customerId:activeCustomer.id,description:"Saldo inicial demo"}}))await db.customerLedgerEntry.createMany({data:[{tenantId,customerId:activeCustomer.id,type:"CHARGE",amountCents:250000,description:"Saldo inicial demo"},{tenantId,customerId:activeCustomer.id,type:"PAYMENT",amountCents:-100000,description:"Pago parcial demo"}]});
}

async function main(){
 const passwordHash=await argon2.hash("Demo1234!",{type:argon2.argon2id});
 const plans=await Promise.all(Object.entries(features).map(([code,value])=>db.plan.upsert({where:{code},update:{features:value},create:{code,name:code[0]+code.slice(1).toLowerCase(),description:`Plan ${code}`,priceCents:code==="BASIC"?1500000:code==="PRO"?3500000:7500000,features:value}})));
 const existingDemo=await db.tenant.findUnique({where:{slug:"centro-demo"}});
 if(existingDemo){
  const currentSettings=existingDemo.settings as Record<string,unknown>;if(currentSettings.customerRegistrationEnabled===undefined)await db.tenant.update({where:{id:existingDemo.id},data:{settings:{...currentSettings,customerRegistrationEnabled:true,customerApprovalRequired:true}}});
  if(!await db.announcement.findFirst({where:{tenantId:existingDemo.id,title:"Reservas online habilitadas"}}))await db.announcement.create({data:{tenantId:existingDemo.id,title:"Reservas online habilitadas",body:"Elegí servicio, fecha y horario desde esta misma pantalla.",style:"SUCCESS",startsAt:addDays(new Date(),-1),endsAt:addDays(new Date(),30)}});
  await ensureCustomerAccountDemo(existingDemo.id,passwordHash);
  console.log("Demo seed already present; incremental demo data verified.");return
 }
 const superadmin=await db.user.create({data:{email:"superadmin@nanolabs.demo",name:"Nano Admin",passwordHash,isSuperAdmin:true}});
 const owner=await db.user.create({data:{email:"admin@onlyturn.demo",name:"Ana Demo",passwordHash}});
 const tenant=await db.tenant.create({data:{slug:"centro-demo",name:"Centro Demo",status:"ACTIVE",category:"Servicios profesionales",timezone:"America/Argentina/Buenos_Aires",currency:"ARS",onboardingStep:8,onboardingDone:true,trialEndsAt:addDays(new Date(),30),settings:{intervalMinutes:30,minimumNoticeMinutes:30,maximumAdvanceDays:60,autoConfirmation:true,cancellationHours:12,customerRegistrationEnabled:true,customerApprovalRequired:true},branding:{primaryColor:"#5b5cf0",description:"Cuidamos tu tiempo y tu bienestar",phone:"+54 11 5555 0101"}}});
 await db.membership.create({data:{tenantId:tenant.id,userId:owner.id,role:"OWNER"}});
 await db.subscription.create({data:{tenantId:tenant.id,planId:plans.find(p=>p.code==="PRO")!.id,status:"ACTIVE",currentPeriodStart:startOfDay(new Date()),currentPeriodEnd:addDays(startOfDay(new Date()),30)}});
 const [centro,norte]=await Promise.all([
  db.location.create({data:{tenantId:tenant.id,name:"Centro",slug:"centro",address:"Av. Corrientes 1234, CABA"}}),
  db.location.create({data:{tenantId:tenant.id,name:"Norte",slug:"norte",address:"Av. Maipú 2450, Vicente López"}})
 ]);
 const [juan,maria,carlos]=await Promise.all([
  db.professional.create({data:{tenantId:tenant.id,locationId:centro.id,name:"Juan",color:"#5b5cf0"}}),
  db.professional.create({data:{tenantId:tenant.id,locationId:centro.id,name:"María",color:"#ec4899"}}),
  db.professional.create({data:{tenantId:tenant.id,locationId:norte.id,name:"Carlos",color:"#f59e0b"}})
 ]);
 const [consultorio1,consultorio2,salaA]=await Promise.all([
  db.resource.create({data:{tenantId:tenant.id,locationId:centro.id,name:"Consultorio 1",type:"Consultorio",color:"#10b981"}}),
  db.resource.create({data:{tenantId:tenant.id,locationId:centro.id,name:"Consultorio 2",type:"Consultorio",color:"#14b8a6"}}),
  db.resource.create({data:{tenantId:tenant.id,locationId:norte.id,name:"Sala A",type:"Sala",capacity:6,color:"#06b6d4"}})
 ]);
 const serviceData=[
  {name:"Consulta",description:"Consulta profesional personalizada",durationMinutes:30,priceCents:1800000,color:"#5b5cf0",professionalMode:"REQUIRED" as const,resourceMode:"OPTIONAL" as const,pros:[juan,maria],res:[consultorio1,consultorio2]},
  {name:"Sesión",description:"Sesión individual",durationMinutes:60,priceCents:2500000,color:"#ec4899",professionalMode:"REQUIRED" as const,resourceMode:"REQUIRED" as const,pros:[maria,carlos],res:[consultorio2,salaA]},
  {name:"Evaluación",description:"Primera evaluación integral",durationMinutes:45,priceCents:2200000,color:"#10b981",professionalMode:"REQUIRED" as const,resourceMode:"OPTIONAL" as const,pros:[juan,carlos],res:[consultorio1]},
  {name:"Servicio Premium",description:"Experiencia completa con seguimiento",durationMinutes:90,priceCents:4200000,color:"#f59e0b",professionalMode:"REQUIRED" as const,resourceMode:"REQUIRED" as const,pros:[juan],res:[salaA]}
 ];
 const services=[];
 for(const item of serviceData){const {pros,res,...data}=item;const s=await db.service.create({data:{tenantId:tenant.id,...data,category:"Atención",locations:{create:[{tenantId:tenant.id,locationId:centro.id},{tenantId:tenant.id,locationId:norte.id}]},professionals:{create:pros.map(p=>({tenantId:tenant.id,professionalId:p.id}))},resources:{create:res.map(r=>({tenantId:tenant.id,resourceId:r.id}))}}});services.push(s)}
 await db.customField.createMany({data:[
  {tenantId:tenant.id,serviceId:services[0].id,key:"motivo_consulta",label:"Motivo de la consulta",type:"TEXTAREA",required:true,sortOrder:1},
  {tenantId:tenant.id,key:"como_nos_conociste",label:"¿Cómo nos conociste?",type:"SELECT",options:["Recomendación","Redes sociales","Búsqueda"],sortOrder:2}
 ]});
 const entities=[{ownerType:"TENANT" as const},{ownerType:"LOCATION" as const,locationId:centro.id},{ownerType:"LOCATION" as const,locationId:norte.id},... [juan,maria,carlos].map(p=>({ownerType:"PROFESSIONAL" as const,professionalId:p.id})),...[consultorio1,consultorio2,salaA].map(r=>({ownerType:"RESOURCE" as const,resourceId:r.id}))];
 for(const entity of entities)for(let weekday=1;weekday<=6;weekday++)await db.availabilityRule.create({data:{tenantId:tenant.id,...entity,weekday,startMinute:weekday===6?540:480,endMinute:weekday===6?780:1200}});
 await db.availabilityException.create({data:{tenantId:tenant.id,professionalId:maria.id,type:"BLOCKED",startsAt:at(3,13),endsAt:at(3,17),reason:"Capacitación"}});
 const customers=[];for(const [i,name] of ["Lucía Pérez","Mateo García","Sofía Rodríguez","Martín López","Valentina Fernández","Tomás Gómez","Camila Díaz","Joaquín Silva"].entries()){const [firstName,lastName]=name.split(" ");customers.push(await db.customer.create({data:{tenantId:tenant.id,firstName,lastName,phone:`+54 11 5555 01${String(i+10).padStart(2,"0")}`,normalizedPhone:`5411555501${String(i+10).padStart(2,"0")}`,email:`${firstName.toLowerCase()}@demo.test`,normalizedEmail:`${firstName.toLowerCase()}@demo.test`,tags:i<2?["Frecuente"]:[]}}))}
 await ensureCustomerAccountDemo(tenant.id,passwordHash);
 const bookingSpecs:{day:number;hour:number;minute?:number;service:number;pro:number;res:number;customer:number;status:BookingStatus}[]=[
  {day:0,hour:9,service:0,pro:0,res:0,customer:0,status:"CONFIRMED"},{day:0,hour:10,service:0,pro:1,res:1,customer:1,status:"CHECKED_IN"},{day:0,hour:11,service:2,pro:2,res:0,customer:2,status:"CONFIRMED"},{day:0,hour:14,service:1,pro:1,res:1,customer:3,status:"CONFIRMED"},
  {day:1,hour:9,service:0,pro:0,res:0,customer:4,status:"CONFIRMED"},{day:1,hour:11,service:1,pro:2,res:2,customer:5,status:"CONFIRMED"},{day:2,hour:16,service:3,pro:0,res:2,customer:6,status:"PENDING"},
  {day:-1,hour:10,service:0,pro:0,res:0,customer:7,status:"COMPLETED"},{day:-2,hour:14,service:1,pro:1,res:1,customer:0,status:"COMPLETED"},{day:-3,hour:11,service:2,pro:2,res:0,customer:1,status:"CANCELLED"}
 ];
 for(const spec of bookingSpecs){const startsAt=at(spec.day,spec.hour,spec.minute??0),service=services[spec.service];const endsAt=addMinutes(startsAt,service.durationMinutes);const booking=await db.booking.create({data:{tenantId:tenant.id,locationId:spec.res===2?norte.id:centro.id,customerId:customers[spec.customer].id,serviceId:service.id,professionalId:[juan,maria,carlos][spec.pro].id,resourceId:[consultorio1,consultorio2,salaA][spec.res].id,startsAt,endsAt,capacityStartsAt:startsAt,capacityEndsAt:endsAt,durationMinutes:service.durationMinutes,priceCents:service.priceCents,status:spec.status,consumesCapacity:!["CANCELLED","NO_SHOW"].includes(spec.status),origin:"ADMIN",createdById:owner.id,cancelledAt:spec.status==="CANCELLED"?new Date():null}});await db.bookingHistory.create({data:{tenantId:tenant.id,bookingId:booking.id,actorId:owner.id,action:"CREATED",toState:{status:spec.status}}})}
 const otherOwner=await db.user.create({data:{email:"otro@onlyturn.demo",name:"Otro Tenant",passwordHash}});const other=await db.tenant.create({data:{slug:"segundo-demo",name:"Segundo Demo",status:"ACTIVE",onboardingStep:8,onboardingDone:true}});await db.membership.create({data:{tenantId:other.id,userId:otherOwner.id,role:"OWNER"}});await db.subscription.create({data:{tenantId:other.id,planId:plans[0].id,status:"ACTIVE",currentPeriodStart:new Date(),currentPeriodEnd:addDays(new Date(),30)}});await db.location.create({data:{tenantId:other.id,name:"Única",slug:"unica"}});
 console.log("Seed complete",{tenant:tenant.slug,owner:owner.email,superadmin:superadmin.email});
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>db.$disconnect());


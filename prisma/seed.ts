import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const plans = {
  BASIC: {
    priceCents: 1500000,
    features: {
      maxLocations: 1,
      maxStaff: 3,
      maxResources: 3,
      maxBookings: 200,
      whatsappNotifications: false,
      advancedReports: false,
      customDomain: false,
      waitlist: false,
      deposits: false,
      recurringBookings: false,
    },
  },
  PRO: {
    priceCents: 3500000,
    features: {
      maxLocations: 3,
      maxStaff: 15,
      maxResources: 20,
      maxBookings: 2000,
      whatsappNotifications: false,
      advancedReports: false,
      customDomain: false,
      waitlist: false,
      deposits: true,
      recurringBookings: false,
    },
  },
  BUSINESS: {
    priceCents: 7500000,
    features: {
      maxLocations: 20,
      maxStaff: 100,
      maxResources: 100,
      maxBookings: 20000,
      whatsappNotifications: false,
      advancedReports: false,
      customDomain: false,
      waitlist: false,
      deposits: true,
      recurringBookings: false,
    },
  },
} as const;

async function main() {
  for (const [code, config] of Object.entries(plans)) {
    await db.plan.upsert({
      where: { code },
      update: { features: config.features, isActive: true },
      create: {
        code,
        name: code[0] + code.slice(1).toLowerCase(),
        description: `Plan ${code}`,
        priceCents: config.priceCents,
        currency: "ARS",
        features: config.features,
        isActive: true,
      },
    });
  }
  console.log("OnlyTurn platform seed complete. No demo tenants or operational data were created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

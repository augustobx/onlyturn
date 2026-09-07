import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

const defaultFeatures = {
  BASIC: {
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
  PRO: {
    maxLocations: 3,
    maxStaff: 15,
    maxResources: 20,
    maxBookings: 2000,
    whatsappNotifications: true,
    advancedReports: true,
    customDomain: false,
    waitlist: true,
    deposits: true,
    recurringBookings: true,
  },
  BUSINESS: {
    maxLocations: 20,
    maxStaff: 100,
    maxResources: 100,
    maxBookings: 20000,
    whatsappNotifications: true,
    advancedReports: true,
    customDomain: true,
    waitlist: true,
    deposits: true,
    recurringBookings: true,
  },
};

async function main() {
  console.log("[bootstrap] Synchronizing platform plans...");
  for (const [code, features] of Object.entries(defaultFeatures)) {
    await db.plan.upsert({
      where: { code },
      update: { features },
      create: {
        code,
        name: code[0] + code.slice(1).toLowerCase(),
        description: `Plan ${code}`,
        priceCents: code === "BASIC" ? 1500000 : code === "PRO" ? 3500000 : 7500000,
        features,
        isActive: true,
      },
    });
  }
  console.log("[bootstrap] Platform plans ready.");

  const email = (process.env.ONLYTURN_SUPERADMIN_EMAIL || process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ONLYTURN_SUPERADMIN_PASSWORD || process.env.SUPERADMIN_PASSWORD || "";
  const name = (process.env.ONLYTURN_SUPERADMIN_NAME || process.env.SUPERADMIN_NAME || "NanoLabs Admin").trim();

  if (email && password.length >= 8) {
    console.log(`[bootstrap] Ensuring SuperAdmin account for ${email}...`);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await db.user.upsert({
      where: { email },
      update: { name, passwordHash, isSuperAdmin: true, isActive: true },
      create: { email, name, passwordHash, isSuperAdmin: true, isActive: true },
    });
    console.log("[bootstrap] SuperAdmin account synchronized.");
  } else {
    console.log("[bootstrap] No SuperAdmin credentials provided in environment. Skipping SuperAdmin upsert.");
  }
}

main()
  .catch((e) => {
    console.error("[bootstrap] Error during platform bootstrap:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

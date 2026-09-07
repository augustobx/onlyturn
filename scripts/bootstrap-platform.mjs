import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

// Feature flags reflect capabilities that are actually production-ready today.
// Future modules stay disabled until their end-to-end flow exists.
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
    whatsappNotifications: false,
    advancedReports: false,
    customDomain: false,
    waitlist: false,
    deposits: true,
    recurringBookings: false,
  },
  BUSINESS: {
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
};

async function main() {
  console.log("[bootstrap] Synchronizing OnlyTurn plans...");
  for (const [code, features] of Object.entries(defaultFeatures)) {
    await db.plan.upsert({
      where: { code },
      update: { features, isActive: true },
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

  if (!email && !password) {
    console.log("[bootstrap] No SuperAdmin credentials provided. Existing accounts are left unchanged.");
    return;
  }

  if (!email || password.length < 10) {
    throw new Error("ONLYTURN_SUPERADMIN_EMAIL and a password of at least 10 characters are required together");
  }

  console.log(`[bootstrap] Ensuring NanoLabs SuperAdmin account for ${email}...`);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.user.upsert({
    where: { email },
    update: { name, passwordHash, isSuperAdmin: true, isActive: true },
    create: { email, name, passwordHash, isSuperAdmin: true, isActive: true },
  });
  console.log("[bootstrap] SuperAdmin account synchronized.");
}

main()
  .catch((error) => {
    console.error("[bootstrap] Error during platform bootstrap:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

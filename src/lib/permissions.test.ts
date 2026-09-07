import { describe, expect, it } from "vitest";
import { can } from "./permissions";
describe("RBAC",()=>{it("prevents professionals from managing bookings",()=>expect(can("PROFESSIONAL",[],"bookings:manage")).toBe(false));it("lets owners manage all tenant settings",()=>expect(can("OWNER",[],"settings:manage")).toBe(true));it("supports explicit permission grants",()=>expect(can("PROFESSIONAL",["bookings:manage"],"bookings:manage")).toBe(true))});

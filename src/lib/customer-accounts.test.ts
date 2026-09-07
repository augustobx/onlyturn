import { describe,expect,it } from "vitest";
import { customerRegistrationStatus,ledgerBalanceCents,signedLedgerAmountCents } from "./customer-accounts";

describe("cuentas de clientes",()=>{
 it("deja pendiente un registro cuando requiere aprobación",()=>expect(customerRegistrationStatus(true)).toBe("PENDING"));
 it("activa el registro cuando no requiere aprobación",()=>expect(customerRegistrationStatus(false)).toBe("ACTIVE"));
 it("aplica el signo contable según el tipo",()=>{expect(signedLedgerAmountCents("CHARGE",1500)).toBe(150000);expect(signedLedgerAmountCents("PAYMENT",500)).toBe(-50000);expect(signedLedgerAmountCents("ADJUSTMENT",-25.5)).toBe(-2550)});
 it("calcula el saldo a partir de movimientos",()=>expect(ledgerBalanceCents([{amountCents:250000},{amountCents:-100000}])).toBe(150000));
});

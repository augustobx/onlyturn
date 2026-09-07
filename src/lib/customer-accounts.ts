export type LedgerKind="CHARGE"|"PAYMENT"|"CREDIT"|"ADJUSTMENT";
export function customerRegistrationStatus(approvalRequired:boolean){return approvalRequired?"PENDING" as const:"ACTIVE" as const}
export function signedLedgerAmountCents(type:LedgerKind,amount:number){if(!Number.isFinite(amount)||amount===0)throw new Error("El importe debe ser distinto de cero");const absolute=Math.round(Math.abs(amount)*100);if(type==="CHARGE")return absolute;if(type==="ADJUSTMENT")return Math.round(amount*100);return-absolute}
export function ledgerBalanceCents(entries:ReadonlyArray<{amountCents:number}>){return entries.reduce((sum,item)=>sum+item.amountCents,0)}

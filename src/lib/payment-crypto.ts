import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(){const secret=process.env.PAYMENT_ENCRYPTION_KEY;if(!secret||secret.length<32)throw new Error("PAYMENT_ENCRYPTION_KEY debe tener al menos 32 caracteres");return createHash("sha256").update(secret).digest()}
export function encryptPaymentCredentials(value:unknown){const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".")}
export function decryptPaymentCredentials<T>(value:string):T{const [version,iv,tag,data]=value.split(".");if(version!=="v1"||!iv||!tag||!data)throw new Error("Credenciales de pago inválidas");const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));decipher.setAuthTag(Buffer.from(tag,"base64url"));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8")) as T}
export function paymentEncryptionReady(){return Boolean(process.env.PAYMENT_ENCRYPTION_KEY&&process.env.PAYMENT_ENCRYPTION_KEY.length>=32)}

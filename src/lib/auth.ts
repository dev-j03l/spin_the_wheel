import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ADMIN_PASSWORD || "dev-secret-change-in-production";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function signAdminToken(roomCode: string): string {
  const expiry = (Date.now() + TOKEN_TTL_MS).toString(36);
  const payload = `${roomCode.toUpperCase()}:${expiry}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyAdminToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [roomCode, expiryStr, sig] = decoded.split(":");
    if (!roomCode || !expiryStr || !sig) return null;
    const expiry = parseInt(expiryStr, 36);
    if (Date.now() > expiry) return null;
    const payload = `${roomCode}:${expiryStr}`;
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;
    return roomCode;
  } catch {
    return null;
  }
}

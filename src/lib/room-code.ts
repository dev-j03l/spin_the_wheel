const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O to avoid confusion
const DIGITS = "0123456789";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  code += "-";
  for (let i = 0; i < 4; i++) {
    code += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  }
  return code;
}

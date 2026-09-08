export type AccessCodeKind = "member" | "admin";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(
  kind: AccessCodeKind,
  randomBytes: (size: number) => Uint8Array = (size) =>
    crypto.getRandomValues(new Uint8Array(size)),
): string {
  const length = kind === "admin" ? 24 : 16;
  const bytes = randomBytes(length);

  if (bytes.length !== length) {
    throw new Error("Random source returned an invalid byte count.");
  }

  const body = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join("");

  return `MTP-${kind === "admin" ? "A" : "M"}-${body}`;
}

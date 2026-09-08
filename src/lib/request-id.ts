const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequestId(headers: Headers): string {
  const incoming = headers.get("x-request-id");

  return incoming && UUID_V4_PATTERN.test(incoming)
    ? incoming.toLowerCase()
    : crypto.randomUUID();
}

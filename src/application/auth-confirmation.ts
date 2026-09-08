export type SupportedEmailOtpType = "invite" | "magiclink";

export interface AuthConfirmation {
  readonly tokenHash: string;
  readonly type: SupportedEmailOtpType;
  readonly nextPath: string;
}

const supportedTypes = new Set<SupportedEmailOtpType>(["invite", "magiclink"]);

export function parseAuthConfirmation(url: URL): AuthConfirmation | null {
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");

  if (
    !tokenHash ||
    !rawType ||
    !supportedTypes.has(rawType as SupportedEmailOtpType)
  ) {
    return null;
  }

  return {
    tokenHash,
    type: rawType as SupportedEmailOtpType,
    nextPath: safeNextPath(url.searchParams.get("next")),
  };
}

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/club";
}

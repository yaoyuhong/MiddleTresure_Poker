import { NextResponse, type NextRequest } from "next/server";

import { getAdminRequestContext } from "@/application/admin-context";
import { accessCodeRotationSchema } from "@/application/registration";
import { generateAccessCode } from "@/domain/access-code";

export async function POST(request: NextRequest) {
  const context = await getAdminRequestContext();
  if (!context) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const input = accessCodeRotationSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const code = generateAccessCode(input.data.kind);
  const { data, error } = await context.supabase.rpc("rotate_access_code", {
    target_kind: input.data.kind,
    new_code: code,
    target_request_id: input.data.requestId,
  });
  if (error) {
    return NextResponse.json(
      { error: "access_code_change_failed" },
      { status: 400 },
    );
  }

  const result = data as { replayed?: boolean; rotated_at?: string } | null;
  if (result?.replayed) {
    return NextResponse.json(
      { error: "rotation_already_completed" },
      { status: 409 },
    );
  }
  return NextResponse.json(
    {
      kind: input.data.kind,
      code,
      rotatedAt: result?.rotated_at ?? new Date().toISOString(),
    },
    {
      status: 201,
      headers: { "cache-control": "no-store" },
    },
  );
}

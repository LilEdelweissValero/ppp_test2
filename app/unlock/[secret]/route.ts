import { NextRequest, NextResponse } from "next/server";
import {
  EDIT_COOKIE_NAME,
  EDIT_COOKIE_OPTIONS,
  signCurrentToken,
  verifyUnlockSecret,
} from "@/lib/edit-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;
  if (!verifyUnlockSecret(secret)) {
    return new NextResponse("Invalid unlock link.", { status: 403 });
  }
  const signed = signCurrentToken();
  if (!signed) {
    return new NextResponse("Editing is not configured.", { status: 403 });
  }
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(EDIT_COOKIE_NAME, signed, EDIT_COOKIE_OPTIONS);
  return res;
}

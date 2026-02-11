import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.SECONDME_CLIENT_ID!,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    response_type: "code",
    scope: "user.info user.info.shades user.info.softmemory chat note.add",
  });

  const url = `${process.env.SECONDME_OAUTH_URL}?${params.toString()}`;
  return NextResponse.redirect(url);
}

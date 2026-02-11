import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserInfo } from "@/lib/secondme";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const info = await getUserInfo(user.accessToken);
  return NextResponse.json({ code: 0, data: info });
}

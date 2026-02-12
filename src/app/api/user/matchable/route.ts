import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  return NextResponse.json({ matchable: user.matchable });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const matchable = Boolean(body.matchable);

  await prisma.user.update({
    where: { id: user.id },
    data: { matchable },
  });

  return NextResponse.json({ matchable });
}

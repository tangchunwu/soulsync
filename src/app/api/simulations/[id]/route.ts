import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  const session = await prisma.simulationSession.findUnique({
    where: { id, userId: user.id },
    include: {
      agentA: { select: { displayName: true, mbti: true } },
      agentB: { select: { displayName: true, mbti: true } },
      rounds: {
        include: { messages: { orderBy: { seq: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  return NextResponse.json(session);
}

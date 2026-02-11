import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ simulationId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { simulationId } = await params;

  const report = await prisma.matchReport.findUnique({
    where: { sessionId: simulationId, userId: user.id },
    include: {
      session: {
        include: {
          agentA: { select: { displayName: true, mbti: true } },
          agentB: { select: { displayName: true, mbti: true } },
          rounds: {
            include: { messages: { orderBy: { seq: "asc" } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "报告不存在" }, { status: 404 });
  }

  return NextResponse.json(report);
}

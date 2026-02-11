import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAgentPersona } from "@/lib/prompt-templates";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { mbti, intent } = await req.json();
  if (!mbti || !intent) {
    return NextResponse.json({ error: "mbti and intent required" }, { status: 400 });
  }

  // 更新用户的 MBTI 和意图
  await prisma.user.update({
    where: { id: user.id },
    data: { mbti, intent },
  });

  // 创建或更新 Agent
  const persona = buildAgentPersona(mbti, intent, user.name || "Agent");

  const agent = await prisma.agentProfile.upsert({
    where: { userId: user.id },
    update: { mbti, intent, promptPersona: persona, displayName: user.name || "My Agent" },
    create: {
      userId: user.id,
      source: "USER",
      displayName: user.name || "My Agent",
      avatarUrl: user.avatarUrl,
      mbti,
      intent,
      promptPersona: persona,
    },
  });

  return NextResponse.json({ code: 0, data: agent });
}

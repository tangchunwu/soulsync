import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSimulation } from "@/lib/simulation-engine";
import { selectCandidates } from "@/lib/candidate-pool";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.agent) {
    return NextResponse.json({ error: "未登录或未创建 Agent" }, { status: 401 });
  }

  try {
    // 使用候选池服务选择 1 个对手
    const candidates = await selectCandidates(user.id, user.accessToken, 1);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "没有可用的匹配对象" }, { status: 500 });
    }

    const picked = candidates[0];
    const opponent = await prisma.agentProfile.findUniqueOrThrow({
      where: { id: picked.agentId },
    });

    const conversationType = picked.secondMeToken ? "A2A" : "SIMULATED";

    const session = await prisma.simulationSession.create({
      data: {
        userId: user.id,
        agentAId: user.agent.id,
        agentBId: opponent.id,
        status: "QUEUED",
        conversationType,
      },
    });

    // 更新用户活跃时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    runSimulation(session.id, user.accessToken, picked.secondMeToken).catch(console.error);

    return NextResponse.json({
      sessionId: session.id,
      conversationType,
      opponent: {
        displayName: opponent.displayName,
        mbti: opponent.mbti,
        avatarUrl: opponent.avatarUrl,
        source: picked.source,
      },
    });
  } catch (err) {
    console.error("Simulation route error:", err);
    return NextResponse.json(
      { error: "匹配失败，请稍后再试" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSimulation } from "@/lib/simulation-engine";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.agent) {
    return NextResponse.json({ error: "未登录或未创建 Agent" }, { status: 401 });
  }

  // 随机选一个 SEED agent 作为对手
  const seeds = await prisma.agentProfile.findMany({
    where: { source: "SEED" },
  });

  if (seeds.length === 0) {
    return NextResponse.json({ error: "没有可用的匹配对象" }, { status: 500 });
  }

  const opponent = seeds[Math.floor(Math.random() * seeds.length)];

  const session = await prisma.simulationSession.create({
    data: {
      userId: user.id,
      agentAId: user.agent.id,
      agentBId: opponent.id,
      status: "QUEUED",
    },
  });

  // 异步执行模拟，不阻塞响应
  runSimulation(session.id).catch(console.error);

  return NextResponse.json({
    sessionId: session.id,
    opponent: {
      displayName: opponent.displayName,
      mbti: opponent.mbti,
    },
  });
}

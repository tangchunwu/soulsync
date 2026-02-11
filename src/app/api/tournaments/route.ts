import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTournament } from "@/lib/tournament-engine";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.agent) {
    return NextResponse.json({ error: "未登录或未创建 Agent" }, { status: 401 });
  }

  const body = await req.json();
  const candidateCount = body.candidateCount as number;

  if (![3, 5, 10].includes(candidateCount)) {
    return NextResponse.json({ error: "候选数量必须为 3、5 或 10" }, { status: 400 });
  }

  // 获取所有 SEED agent
  const seeds = await prisma.agentProfile.findMany({
    where: { source: "SEED" },
  });

  if (seeds.length < candidateCount) {
    return NextResponse.json(
      { error: `可用候选不足，需要 ${candidateCount} 个，当前仅 ${seeds.length} 个` },
      { status: 400 },
    );
  }

  // 随机选 N 个不重复的 SEED
  const shuffled = [...seeds].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, candidateCount);

  // 创建锦标赛
  const tournament = await prisma.tournament.create({
    data: {
      userId: user.id,
      candidateCount,
      status: "PENDING",
      candidates: {
        create: selected.map((agent) => ({
          agentId: agent.id,
          status: "ACTIVE",
        })),
      },
    },
    include: {
      candidates: { include: { agent: true } },
    },
  });

  // 异步启动锦标赛
  runTournament(tournament.id).catch(console.error);

  return NextResponse.json({
    tournamentId: tournament.id,
    candidates: tournament.candidates.map((c) => ({
      candidateId: c.id,
      displayName: c.agent.displayName,
      mbti: c.agent.mbti,
      agentId: c.agentId,
    })),
  });
}

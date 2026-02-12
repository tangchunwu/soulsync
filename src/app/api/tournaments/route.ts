import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTournament } from "@/lib/tournament-engine";
import { selectCandidates } from "@/lib/candidate-pool";

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

  try {
    // 使用候选池服务选择候选人
    const poolCandidates = await selectCandidates(user.id, user.accessToken, candidateCount);

    if (poolCandidates.length < candidateCount) {
      return NextResponse.json(
        { error: `可用候选不足，需要 ${candidateCount} 个，当前仅 ${poolCandidates.length} 个` },
        { status: 400 },
      );
    }

    // 创建锦标赛
    const tournament = await prisma.tournament.create({
      data: {
        userId: user.id,
        candidateCount,
        status: "PENDING",
        candidates: {
          create: poolCandidates.map((c) => ({
            agentId: c.agentId,
            status: "ACTIVE",
          })),
        },
      },
      include: {
        candidates: { include: { agent: true } },
      },
    });

    // 更新用户活跃时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    // 异步启动锦标赛
    runTournament(tournament.id, user.accessToken).catch(console.error);

    // 构建候选人来源映射
    const sourceMap = new Map(poolCandidates.map((c) => [c.agentId, c.source]));

    return NextResponse.json({
      tournamentId: tournament.id,
      candidates: tournament.candidates.map((c) => ({
        candidateId: c.id,
        displayName: c.agent.displayName,
        mbti: c.agent.mbti,
        agentId: c.agentId,
        avatarUrl: c.agent.avatarUrl,
        source: sourceMap.get(c.agentId) ?? "SEED",
      })),
    });
  } catch (err) {
    console.error("Tournament route error:", err);
    return NextResponse.json(
      { error: "锦标赛创建失败，请稍后再试" },
      { status: 500 },
    );
  }
}

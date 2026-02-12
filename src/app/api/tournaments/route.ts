import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTournament } from "@/lib/tournament-engine";
import { fetchBookUsers, fetchBookUserDetail, extractMbtiFromBio, buildPersonaFromBio } from "@/lib/secondme";

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
    // 从 SecondmeBook 拉取真实用户
    const bookUsers = await fetchBookUsers(user.accessToken, candidateCount + 5);
    const candidates = bookUsers.filter(u => u.nickname !== user.name);

    if (candidates.length < candidateCount) {
      return NextResponse.json(
        { error: `可用真实用户不足，需要 ${candidateCount} 个，当前仅 ${candidates.length} 个` },
        { status: 400 },
      );
    }

    // 随机选 N 个不重复的
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, candidateCount);

    // 为每个真实用户创建 AgentProfile
    const agentIds: string[] = [];
    for (const picked of selected) {
      const detail = await fetchBookUserDetail(user.accessToken, picked.id);
      const mbti = extractMbtiFromBio(detail.bio);
      const persona = buildPersonaFromBio(detail.nickname, detail.bio, detail.selfIntroduction);

      const agent = await prisma.agentProfile.upsert({
        where: { id: `book_${picked.id}` },
        update: {
          displayName: detail.nickname,
          avatarUrl: detail.avatar,
          mbti,
          promptPersona: persona,
        },
        create: {
          id: `book_${picked.id}`,
          source: "BOOK",
          displayName: detail.nickname,
          avatarUrl: detail.avatar,
          mbti,
          promptPersona: persona,
        },
      });
      agentIds.push(agent.id);
    }

    // 创建锦标赛
    const tournament = await prisma.tournament.create({
      data: {
        userId: user.id,
        candidateCount,
        status: "PENDING",
        candidates: {
          create: agentIds.map((agentId) => ({
            agentId,
            status: "ACTIVE",
          })),
        },
      },
      include: {
        candidates: { include: { agent: true } },
      },
    });

    // 异步启动锦标赛
    runTournament(tournament.id, user.accessToken).catch(console.error);

    return NextResponse.json({
      tournamentId: tournament.id,
      candidates: tournament.candidates.map((c) => ({
        candidateId: c.id,
        displayName: c.agent.displayName,
        mbti: c.agent.mbti,
        agentId: c.agentId,
        avatarUrl: c.agent.avatarUrl,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch SecondmeBook users, falling back to SEED:", err);
    // 降级：用 SEED agent
    const seeds = await prisma.agentProfile.findMany({ where: { source: "SEED" } });
    if (seeds.length < candidateCount) {
      return NextResponse.json(
        { error: `可用候选不足，需要 ${candidateCount} 个，当前仅 ${seeds.length} 个` },
        { status: 400 },
      );
    }
    const shuffled = [...seeds].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, candidateCount);
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
      include: { candidates: { include: { agent: true } } },
    });
    runTournament(tournament.id, user.accessToken).catch(console.error);
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
}

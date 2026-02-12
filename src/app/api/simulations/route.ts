import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSimulation } from "@/lib/simulation-engine";
import { fetchBookUsers, fetchBookUserDetail, extractMbtiFromBio, buildPersonaFromBio } from "@/lib/secondme";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.agent) {
    return NextResponse.json({ error: "未登录或未创建 Agent" }, { status: 401 });
  }

  try {
    // 从 SecondmeBook 拉取真实用户作为对手
    const bookUsers = await fetchBookUsers(user.accessToken, 10);
    // 过滤掉自己
    const candidates = bookUsers.filter(u => u.nickname !== user.name);
    if (candidates.length === 0) {
      return NextResponse.json({ error: "没有可用的匹配对象" }, { status: 500 });
    }

    // 随机选一个
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const detail = await fetchBookUserDetail(user.accessToken, picked.id);
    const mbti = extractMbtiFromBio(detail.bio);
    const persona = buildPersonaFromBio(detail.nickname, detail.bio, detail.selfIntroduction);

    // 创建或更新对手的 AgentProfile（source=BOOK）
    const opponent = await prisma.agentProfile.upsert({
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

    const session = await prisma.simulationSession.create({
      data: {
        userId: user.id,
        agentAId: user.agent.id,
        agentBId: opponent.id,
        status: "QUEUED",
      },
    });

    runSimulation(session.id, user.accessToken).catch(console.error);

    return NextResponse.json({
      sessionId: session.id,
      opponent: {
        displayName: opponent.displayName,
        mbti: opponent.mbti,
        avatarUrl: opponent.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Failed to fetch SecondmeBook users, falling back to SEED:", err);
    // 降级：用 SEED agent
    const seeds = await prisma.agentProfile.findMany({ where: { source: "SEED" } });
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
    runSimulation(session.id, user.accessToken).catch(console.error);
    return NextResponse.json({
      sessionId: session.id,
      opponent: { displayName: opponent.displayName, mbti: opponent.mbti },
    });
  }
}

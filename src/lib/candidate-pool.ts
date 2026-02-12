import { prisma } from "./prisma";
import { getValidToken } from "./token-manager";
import {
  fetchBookUsers,
  fetchBookUserDetail,
  extractMbtiFromBio,
  buildPersonaFromBio,
} from "./secondme";

export interface PoolCandidate {
  agentId: string;
  source: "REGISTERED" | "BOOK" | "SEED";
  userId?: string;
  secondMeToken?: string; // 仅服务端使用，不暴露给前端
}

/**
 * 混合候选池：注册用户优先 + SecondmeBook 补充 + SEED 降级
 */
export async function selectCandidates(
  requestingUserId: string,
  requestingUserToken: string,
  count: number,
): Promise<PoolCandidate[]> {
  const result: PoolCandidate[] = [];

  // 1. 查注册用户池
  try {
    const registeredUsers = await prisma.user.findMany({
      where: {
        matchable: true,
        id: { not: requestingUserId },
        agent: { isNot: null },
      },
      orderBy: { lastActiveAt: "desc" },
      take: count * 2, // 多取一些，token 验证可能失败
      include: { agent: true },
    });

    for (const user of registeredUsers) {
      if (result.length >= count) break;
      if (!user.agent) continue;

      const token = await getValidToken(user.id);
      if (token) {
        result.push({
          agentId: user.agent.id,
          source: "REGISTERED",
          userId: user.id,
          secondMeToken: token,
        });
      }
    }
  } catch (err) {
    console.error("[candidate-pool] Failed to query registered users:", err);
  }

  // 2. REGISTERED 不足 → 从 SecondmeBook 补充
  if (result.length < count) {
    try {
      const needed = count - result.length;
      const bookUsers = await fetchBookUsers(requestingUserToken, needed + 5);
      const existingAgentIds = new Set(result.map((r) => r.agentId));

      for (const bookUser of bookUsers) {
        if (result.length >= count) break;
        const agentId = `book_${bookUser.id}`;
        if (existingAgentIds.has(agentId)) continue;

        const detail = await fetchBookUserDetail(requestingUserToken, bookUser.id);
        const mbti = extractMbtiFromBio(detail.bio);
        const persona = buildPersonaFromBio(detail.nickname, detail.bio, detail.selfIntroduction);

        // 创建或更新 AgentProfile，写入预留字段
        await prisma.agentProfile.upsert({
          where: { id: agentId },
          update: {
            displayName: detail.nickname,
            avatarUrl: detail.avatar,
            mbti,
            promptPersona: persona,
            bookUserId: bookUser.id,
            bookBio: detail.bio,
            bookSelfIntro: detail.selfIntroduction,
          },
          create: {
            id: agentId,
            source: "BOOK",
            displayName: detail.nickname,
            avatarUrl: detail.avatar,
            mbti,
            promptPersona: persona,
            bookUserId: bookUser.id,
            bookBio: detail.bio,
            bookSelfIntro: detail.selfIntroduction,
          },
        });

        result.push({ agentId, source: "BOOK" });
      }
    } catch (err) {
      console.error("[candidate-pool] Failed to fetch book users:", err);
    }
  }

  // 3. 仍不足 → SEED 降级
  if (result.length < count) {
    try {
      const needed = count - result.length;
      const existingAgentIds = new Set(result.map((r) => r.agentId));
      const seeds = await prisma.agentProfile.findMany({
        where: { source: "SEED", id: { notIn: [...existingAgentIds] } },
        take: needed,
      });

      for (const seed of seeds) {
        result.push({ agentId: seed.id, source: "SEED" });
      }
    } catch (err) {
      console.error("[candidate-pool] Failed to query seed agents:", err);
    }
  }

  return result;
}

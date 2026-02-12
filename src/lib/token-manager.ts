import { prisma } from "./prisma";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 距过期 5 分钟即刷新
const BASE_URL = process.env.SECONDME_API_BASE_URL!;

// 内存锁：防止同一用户并发刷新
const refreshLocks = new Map<string, Promise<string | null>>();

/**
 * 获取用户的有效 SecondMe accessToken。
 * - token 未过期 → 直接返回
 * - 即将过期 → 刷新后返回
 * - 刷新失败 → 返回 null（调用方降级到 LLM）
 */
export async function getValidToken(userId: string): Promise<string | null> {
  // 如果已有正在进行的刷新，复用结果
  const existing = refreshLocks.get(userId);
  if (existing) return existing;

  const promise = doGetValidToken(userId);
  refreshLocks.set(userId, promise);

  try {
    return await promise;
  } finally {
    refreshLocks.delete(userId);
  }
}

async function doGetValidToken(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { accessToken: true, refreshToken: true, tokenExpiresAt: true },
    });

    if (!user) return null;

    const now = Date.now();
    const expiresAt = new Date(user.tokenExpiresAt).getTime();

    // token 仍然有效且距过期 > 5 分钟
    if (expiresAt - now > REFRESH_BUFFER_MS) {
      return user.accessToken;
    }

    // 需要刷新
    const refreshed = await refreshAccessToken(user.refreshToken);
    if (!refreshed) return null;

    // 写回数据库
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? user.refreshToken,
        tokenExpiresAt: new Date(refreshed.expiresAt),
      },
    });

    return refreshed.accessToken;
  } catch (err) {
    console.error(`[token-manager] Failed to get valid token for user ${userId}:`, err);
    return null;
  }
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number } | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/secondme/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      console.error(`[token-manager] Refresh failed: ${res.status}`);
      return null;
    }

    const json = await res.json();
    const data = json.data ?? json;

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt ?? Date.now() + 3600 * 1000,
    };
  } catch (err) {
    console.error("[token-manager] Refresh request error:", err);
    return null;
  }
}

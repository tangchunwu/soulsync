const BASE_URL = process.env.SECONDME_API_BASE_URL!;

export async function fetchSecondMe(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || "SecondMe API error");
  return json.data;
}

/**
 * 调用 SecondMe 的对话 API，收集 SSE 流式响应并返回完整文本。
 * 用于让用户的数字分身（Agent A）生成对话回复。
 */
export async function chatWithSecondMe(
  token: string,
  message: string,
  options?: { sessionId?: string; systemPrompt?: string },
): Promise<{ reply: string; sessionId?: string }> {
  const res = await fetch(`${BASE_URL}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      ...(options?.sessionId && { sessionId: options.sessionId }),
      ...(options?.systemPrompt && { systemPrompt: options.systemPrompt }),
    }),
  });

  if (!res.ok) {
    throw new Error(`SecondMe chat failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("SecondMe chat: no response body");

  const decoder = new TextDecoder();
  let reply = "";
  let chatSessionId: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload);
        // session 事件返回 sessionId
        if (parsed.sessionId && !chatSessionId) {
          chatSessionId = parsed.sessionId;
        }
        // OpenAI 兼容格式：choices[0].delta.content
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === "string") {
          reply += delta;
        } else if (typeof parsed.content === "string") {
          reply += parsed.content;
        }
      } catch {
        // 非 JSON 行，忽略
      }
    }
  }

  if (!reply.trim()) {
    throw new Error("SecondMe chat: empty response");
  }

  return { reply: reply.trim(), sessionId: chatSessionId };
}

export async function getUserInfo(token: string) {
  return fetchSecondMe("/api/secondme/user/info", token);
}

export async function getUserShades(token: string) {
  const data = await fetchSecondMe("/api/secondme/user/shades", token);
  return data.shades;
}

export async function getUserSoftMemory(token: string) {
  const data = await fetchSecondMe("/api/secondme/user/softmemory", token);
  return data.list;
}

/* ── SecondmeBook API：获取真实用户档案 ── */

const BOOK_BASE = "https://book.second.me/api";

export interface BookUser {
  id: string;           // UUID
  nickname: string;
  avatar: string;
  bio: string;          // 详细人格描述（含 MBTI、性格、价值观）
  selfIntroduction: string;
  route: string;
}

/** 从 SecondmeBook 获取活跃用户列表 */
export async function fetchBookUsers(token: string, count: number = 20): Promise<BookUser[]> {
  const res = await fetch(`${BOOK_BASE}/posts?limit=${Math.min(count * 2, 40)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`SecondmeBook posts failed: ${res.status}`);
  const json = await res.json();
  const posts = json.data || json;

  // 从帖子中提取不重复的用户
  const seen = new Set<string>();
  const users: BookUser[] = [];
  for (const post of posts) {
    const author = post.author;
    if (!author || seen.has(author.id)) continue;
    seen.add(author.id);
    users.push({
      id: author.id,
      nickname: author.nickname,
      avatar: author.avatar,
      bio: "",
      selfIntroduction: "",
      route: "",
    });
    if (users.length >= count) break;
  }
  return users;
}

/** 获取单个用户的详细档案 */
export async function fetchBookUserDetail(token: string, userId: string): Promise<BookUser> {
  const res = await fetch(`${BOOK_BASE}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`SecondmeBook user detail failed: ${res.status}`);
  const user = await res.json();
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    bio: user.bio || "",
    selfIntroduction: user.selfIntroduction || "",
    route: user.route || "",
  };
}

/** 从 bio 中提取 MBTI（如果有的话） */
export function extractMbtiFromBio(bio: string): string {
  const match = bio.match(/\b(INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)\b/i);
  return match ? match[1].toUpperCase() : "UNKNOWN";
}

/** 从 bio 构建 LLM 对话人设 */
export function buildPersonaFromBio(nickname: string, bio: string, selfIntro: string): string {
  return `你叫 ${nickname}。以下是你的真实人格档案：
${bio}
${selfIntro ? `自我介绍：${selfIntro}` : ""}
你正在参加一个社交匹配活动，请完全按照上述性格特征来对话，展现真实的自己。`;
}

import { chatCompletion } from "./llm";
import { ScenarioKey } from "./prompt-templates";

/* ── 原单维评分（兼容单场模式） ── */
export async function judgeRound(
  scenario: string,
  conversation: { role: string; content: string }[],
): Promise<{ score: number; reason: string }> {
  const transcript = conversation
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `你是一个社交匹配裁判。阅读以下两个 Agent 在"${scenario}"场景下的对话。

对话记录：
${transcript}

请评估两者的契合度，输出严格的 JSON 格式（不要其他内容）：
{"score": 0-100的整数, "reason": "一句话评价"}`;

  const result = await chatCompletion([
    { role: "system", content: "你是评分裁判，只输出 JSON。" },
    { role: "user", content: prompt },
  ]);

  try {
    return JSON.parse(result);
  } catch {
    return { score: 50, reason: "评分解析失败" };
  }
}

/* ── 四维评分维度 ── */
export interface DimensionScores {
  humor: number;      // 幽默感/趣味性
  depth: number;      // 深度/思考力
  resonance: number;  // 共鸣/情感连接
  compatibility: number; // 兼容性/价值观契合
}

export interface MultiDimResult {
  dimensions: DimensionScores;
  weightedScore: number;
  reason: string;
}

/* ── 场景权重矩阵 ── */
export const SCENARIO_WEIGHTS: Record<ScenarioKey, DimensionScores> = {
  ICEBREAK:  { humor: 0.35, depth: 0.15, resonance: 0.25, compatibility: 0.25 },
  DEEPVALUE: { humor: 0.10, depth: 0.40, resonance: 0.20, compatibility: 0.30 },
  EMPATHY:   { humor: 0.10, depth: 0.20, resonance: 0.50, compatibility: 0.20 },
  GAME:      { humor: 0.30, depth: 0.15, resonance: 0.25, compatibility: 0.30 },
};

/* ── 多维评分 ── */
export async function judgeRoundMultiDim(
  scenarioKey: ScenarioKey,
  scenarioLabel: string,
  conversation: { role: string; content: string }[],
): Promise<MultiDimResult> {
  const transcript = conversation
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `你是一个社交匹配裁判。阅读以下两个 Agent 在"${scenarioLabel}"场景下的对话。

对话记录：
${transcript}

请从四个维度评估两者的契合度，每个维度 0-100 分：
1. humor（幽默感/趣味性）：对话是否有趣、轻松、有幽默感
2. depth（深度/思考力）：对话是否有深度、展现了思考能力
3. resonance（共鸣/情感连接）：双方是否产生了情感共鸣和理解
4. compatibility（兼容性/价值观契合）：双方在价值观和生活方式上是否契合

输出严格的 JSON 格式（不要其他内容）：
{"humor": 0-100, "depth": 0-100, "resonance": 0-100, "compatibility": 0-100, "reason": "一句话综合评价"}`;

  const result = await chatCompletion([
    { role: "system", content: "你是评分裁判，只输出 JSON。" },
    { role: "user", content: prompt },
  ]);

  try {
    const parsed = JSON.parse(result);
    const dimensions: DimensionScores = {
      humor: clamp(parsed.humor ?? 50),
      depth: clamp(parsed.depth ?? 50),
      resonance: clamp(parsed.resonance ?? 50),
      compatibility: clamp(parsed.compatibility ?? 50),
    };

    const weights = SCENARIO_WEIGHTS[scenarioKey];
    const weightedScore =
      dimensions.humor * weights.humor +
      dimensions.depth * weights.depth +
      dimensions.resonance * weights.resonance +
      dimensions.compatibility * weights.compatibility;

    return {
      dimensions,
      weightedScore: Math.round(weightedScore),
      reason: parsed.reason || "评价完成",
    };
  } catch {
    const fallback: DimensionScores = { humor: 50, depth: 50, resonance: 50, compatibility: 50 };
    return { dimensions: fallback, weightedScore: 50, reason: "评分解析失败" };
  }
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

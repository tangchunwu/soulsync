import { chatCompletion } from "./llm";
import { chatWithSecondMe } from "./secondme";
import { judgeRound } from "./scoring";
import { SCENARIOS, ScenarioKey } from "./prompt-templates";
import { prisma } from "./prisma";

const PASS_THRESHOLD = 60;

export interface AgentData {
  id: string;
  promptPersona: string;
  displayName: string;
}

/* ── 单场模拟 ── */
export async function runSimulation(sessionId: string, secondMeTokenA?: string, secondMeTokenB?: string) {
  const session = await prisma.simulationSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { agentA: true, agentB: true },
  });

  await prisma.simulationSession.update({
    where: { id: sessionId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const scenarioKeys: ScenarioKey[] = ["ICEBREAK", "DEEPVALUE", "EMPATHY"];
  const scores: number[] = [];

  try {
    for (const key of scenarioKeys) {
      const result = await runScenario(sessionId, key, session.agentA, session.agentB, 3, secondMeTokenA, secondMeTokenB);

      scores.push(result.score);

      if (result.score < PASS_THRESHOLD) {
        await prisma.simulationSession.update({
          where: { id: sessionId },
          data: {
            status: "TERMINATED",
            terminateReason: `${SCENARIOS[key].label} 得分 ${result.score} < ${PASS_THRESHOLD}`,
            overallScore: avg(scores),
            matched: false,
            finishedAt: new Date(),
          },
        });
        return;
      }
    }

    const overall = avg(scores);
    const matched = overall >= 70;

    await prisma.simulationSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", overallScore: overall, matched, finishedAt: new Date() },
    });

    if (matched) {
      await prisma.matchReport.create({
        data: {
          sessionId,
          userId: session.userId,
          compatibilityScore: overall,
          recommendation: `综合匹配度 ${overall.toFixed(0)}%`,
        },
      });
    }
  } catch (err) {
    console.error("Simulation error:", err);
    await prisma.simulationSession.update({
      where: { id: sessionId },
      data: {
        status: "TERMINATED",
        terminateReason: `引擎错误: ${err instanceof Error ? err.message : String(err)}`,
        overallScore: scores.length > 0 ? avg(scores) : 0,
        matched: false,
        finishedAt: new Date(),
      },
    });
  }
}

/* ── 单场景对话（导出供锦标赛引擎复用） ── */
export async function runScenario(
  sessionId: string,
  scenarioKey: ScenarioKey,
  agentA: AgentData,
  agentB: AgentData,
  roundCount: number = 3,
  secondMeTokenA?: string,
  secondMeTokenB?: string,
) {
  const scenario = SCENARIOS[scenarioKey];
  const messages: { role: string; content: string }[] = [];

  const round = await prisma.simulationRound.create({
    data: {
      sessionId,
      scenario: scenarioKey,
      score: 0,
      scoreReason: "",
      result: "PENDING",
      roundCount,
    },
  });

  let seq = 0;
  // SecondMe 会话 ID，跨轮次保持上下文
  let smSessionIdA: string | undefined;
  let smSessionIdB: string | undefined;

  for (let i = 0; i < roundCount; i++) {
    // ── Agent A 发言 ──
    let aReply: string;

    if (secondMeTokenA) {
      // 走 SecondMe 对话 API（用户的数字分身）
      const prompt = i === 0
        ? `你正在参加一个社交匹配活动。场景：${scenario.system}\n请先开始对话，展现你的真实性格。`
        : messages[messages.length - 1].content; // 对手上一轮的回复

      const smResult = await chatWithSecondMe(secondMeTokenA, prompt, {
        sessionId: smSessionIdA,
        systemPrompt: i === 0 ? `场景：${scenario.system}` : undefined,
      });
      aReply = smResult.reply;
      if (smResult.sessionId) smSessionIdA = smResult.sessionId;
    } else {
      // 降级：走 LLM
      aReply = await chatCompletion([
        { role: "system", content: `${agentA.promptPersona}\n场景：${scenario.system}` },
        ...messages.map((m) => ({
          role: (m.role === "AGENT_A" ? "assistant" : "user") as "assistant" | "user",
          content: m.content,
        })),
      ]);
    }

    messages.push({ role: "AGENT_A", content: aReply });
    await prisma.roundMessage.create({
      data: { roundId: round.id, role: "AGENT_A", content: aReply, seq: seq++ },
    });

    // ── Agent B 发言 ──
    let bReply: string;
    if (secondMeTokenB) {
      // 真实 A2A：走 SecondMe Chat API
      const bPrompt = i === 0
        ? `你正在参加一个社交匹配活动。场景：${scenario.system}\n对方说：${aReply}\n请自然回复。`
        : aReply;
      const smResultB = await chatWithSecondMe(secondMeTokenB, bPrompt, {
        sessionId: smSessionIdB,
        systemPrompt: i === 0 ? `场景：${scenario.system}` : undefined,
      });
      bReply = smResultB.reply;
      if (smResultB.sessionId) smSessionIdB = smResultB.sessionId;
    } else {
      // 降级：走 LLM 角色扮演（现有逻辑不变）
      bReply = await chatCompletion([
        { role: "system", content: `${agentB.promptPersona}\n场景：${scenario.system}` },
        ...messages.map((m) => ({
          role: (m.role === "AGENT_B" ? "assistant" : "user") as "assistant" | "user",
          content: m.content,
        })),
      ]);
    }
    messages.push({ role: "AGENT_B", content: bReply });
    await prisma.roundMessage.create({
      data: { roundId: round.id, role: "AGENT_B", content: bReply, seq: seq++ },
    });
  }

  // ── 裁判评分（始终走 LLM） ──
  const judge = await judgeRound(scenario.label, messages);

  await prisma.simulationRound.update({
    where: { id: round.id },
    data: {
      score: judge.score,
      scoreReason: judge.reason,
      result: judge.score < PASS_THRESHOLD ? "STOP_LOW_SCORE" : "PASS",
    },
  });

  return judge;
}

export function avg(nums: number[]) {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

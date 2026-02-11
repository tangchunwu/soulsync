import { chatCompletion } from "./llm";
import { judgeRound } from "./scoring";
import { SCENARIOS, ScenarioKey } from "./prompt-templates";
import { prisma } from "./prisma";

const PASS_THRESHOLD = 60;

export interface AgentData {
  id: string;
  promptPersona: string;
  displayName: string;
}

/* ── 单场模拟（保留原有逻辑） ── */
export async function runSimulation(sessionId: string) {
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
      const result = await runScenario(sessionId, key, session.agentA, session.agentB);

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

  for (let i = 0; i < roundCount; i++) {
    // Agent A 发言
    const aReply = await chatCompletion([
      { role: "system", content: `${agentA.promptPersona}\n场景：${scenario.system}` },
      ...messages.map((m) => ({
        role: (m.role === "AGENT_A" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
    ]);
    messages.push({ role: "AGENT_A", content: aReply });
    await prisma.roundMessage.create({
      data: { roundId: round.id, role: "AGENT_A", content: aReply, seq: seq++ },
    });

    // Agent B 发言
    const bReply = await chatCompletion([
      { role: "system", content: `${agentB.promptPersona}\n场景：${scenario.system}` },
      ...messages.map((m) => ({
        role: (m.role === "AGENT_B" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
    ]);
    messages.push({ role: "AGENT_B", content: bReply });
    await prisma.roundMessage.create({
      data: { roundId: round.id, role: "AGENT_B", content: bReply, seq: seq++ },
    });
  }

  // 裁判评分
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

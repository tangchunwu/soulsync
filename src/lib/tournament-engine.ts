import { prisma } from "./prisma";
import { chatCompletion } from "./llm";
import { SCENARIOS, ScenarioKey, GAME_QUESTIONS } from "./prompt-templates";
import { judgeRoundMultiDim, MultiDimResult, DimensionScores } from "./scoring";
import { runScenario, AgentData, avg } from "./simulation-engine";

/* ── 淘汰策略 ── */
const ELIMINATION_TABLE: Record<number, number[]> = {
  // [破冰后保留, 价值观后保留, 共情后保留, 游戏]
  3:  [2, 1, 1, 1],
  5:  [3, 2, 1, 1],
  10: [5, 3, 2, 1],
};

const PHASE_SCENARIOS: ScenarioKey[] = ["ICEBREAK", "DEEPVALUE", "EMPATHY", "GAME"];
const PHASE_LABELS = ["破冰阶段", "价值观阶段", "共情阶段", "游戏阶段"];

/* ── 候选人运行时数据 ── */
interface CandidateRuntime {
  candidateId: string;
  agentId: string;
  agent: AgentData;
  sessionId: string;
  scores: MultiDimResult[];
  totalWeighted: number;
  eliminated: boolean;
}

/* ── 锦标赛事件发射器（写入数据库供 SSE 轮询） ── */
async function emitTournamentEvent(tournamentId: string, event: string, data: unknown) {
  // 将事件写入一个轻量 JSON 字段，SSE 端点轮询时读取
  // 使用 tournament 的 currentPhase 字段记录最新状态
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { currentPhase: JSON.stringify({ event, data, ts: Date.now() }) },
  });
}

/* ── 主编排函数 ── */
export async function runTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: {
      candidates: { include: { agent: true } },
      user: { include: { agent: true } },
    },
  });

  if (!tournament.user.agent) throw new Error("用户未创建 Agent");

  const userAgent: AgentData = {
    id: tournament.user.agent.id,
    promptPersona: tournament.user.agent.promptPersona,
    displayName: tournament.user.agent.displayName,
  };

  const candidateCount = tournament.candidateCount;
  const retainCounts = ELIMINATION_TABLE[candidateCount] || getDefaultRetain(candidateCount);

  // 初始化候选人运行时
  const candidates: CandidateRuntime[] = [];
  for (const c of tournament.candidates) {
    // 为每个候选人创建一个 SimulationSession
    const session = await prisma.simulationSession.create({
      data: {
        userId: tournament.userId,
        agentAId: userAgent.id,
        agentBId: c.agentId,
        tournamentId,
        candidateId: c.id,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    candidates.push({
      candidateId: c.id,
      agentId: c.agentId,
      agent: {
        id: c.agent.id,
        promptPersona: c.agent.promptPersona,
        displayName: c.agent.displayName,
      },
      sessionId: session.id,
      scores: [],
      totalWeighted: 0,
      eliminated: false,
    });
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: "RUNNING" },
  });

  // 发送候选人列表事件
  await emitTournamentEvent(tournamentId, "candidates", candidates.map(c => ({
    candidateId: c.candidateId,
    agentId: c.agentId,
    displayName: c.agent.displayName,
    sessionId: c.sessionId,
  })));

  try {
    // 4 阶段顺序执行
    for (let phaseIdx = 0; phaseIdx < PHASE_SCENARIOS.length; phaseIdx++) {
      const scenarioKey = PHASE_SCENARIOS[phaseIdx];
      const retainCount = retainCounts[phaseIdx];
      const activeCandidates = candidates.filter(c => !c.eliminated);

      // 如果只剩 1 个候选人，跳过后续阶段
      if (activeCandidates.length <= 1) break;

      await emitTournamentEvent(tournamentId, "phase_start", {
        phase: phaseIdx,
        scenario: scenarioKey,
        label: PHASE_LABELS[phaseIdx],
        activeCandidates: activeCandidates.map(c => c.candidateId),
      });

      // 并发执行当前阶段
      if (scenarioKey === "GAME") {
        await runGamePhase(tournamentId, activeCandidates, userAgent);
      } else {
        await runDialoguePhase(tournamentId, scenarioKey, activeCandidates, userAgent);
      }

      // 淘汰排名靠后的候选人
      if (phaseIdx < PHASE_SCENARIOS.length - 1) {
        eliminateCandidates(activeCandidates, retainCount, PHASE_LABELS[phaseIdx]);
      }

      // 发送淘汰事件
      const eliminated = activeCandidates.filter(c => c.eliminated);
      const surviving = candidates.filter(c => !c.eliminated);
      await emitTournamentEvent(tournamentId, "elimination", {
        phase: phaseIdx,
        eliminated: eliminated.map(c => ({
          candidateId: c.candidateId,
          displayName: c.agent.displayName,
          totalScore: c.totalWeighted,
        })),
        surviving: surviving.map(c => ({
          candidateId: c.candidateId,
          displayName: c.agent.displayName,
          totalScore: c.totalWeighted,
        })),
      });

      // 更新被淘汰候选人的数据库状态
      for (const c of eliminated) {
        await prisma.tournamentCandidate.update({
          where: { id: c.candidateId },
          data: {
            status: "ELIMINATED",
            totalScore: c.totalWeighted,
            eliminatedAt: PHASE_LABELS[phaseIdx],
          },
        });
        await prisma.simulationSession.update({
          where: { id: c.sessionId },
          data: { status: "TERMINATED", terminateReason: `淘汰于${PHASE_LABELS[phaseIdx]}`, finishedAt: new Date() },
        });
      }
    }

    // 决出冠军
    const winner = candidates.filter(c => !c.eliminated)
      .sort((a, b) => b.totalWeighted - a.totalWeighted)[0];

    if (winner) {
      // 更新冠军状态
      await prisma.tournamentCandidate.update({
        where: { id: winner.candidateId },
        data: { status: "WINNER", totalScore: winner.totalWeighted, rank: 1 },
      });

      // 更新冠军 session
      const overallScore = winner.totalWeighted / Math.max(winner.scores.length, 1);
      await prisma.simulationSession.update({
        where: { id: winner.sessionId },
        data: {
          status: "COMPLETED",
          overallScore,
          matched: overallScore >= 70,
          finishedAt: new Date(),
        },
      });

      // 生成匹配报告
      const avgDimensions = averageDimensions(winner.scores.map(s => s.dimensions));
      await prisma.matchReport.create({
        data: {
          sessionId: winner.sessionId,
          userId: tournament.userId,
          tournamentId,
          compatibilityScore: overallScore,
          dimensionScores: avgDimensions as unknown as Record<string, number>,
          recommendation: `锦标赛冠军！综合匹配度 ${overallScore.toFixed(0)}%`,
        },
      });

      // 排名所有候选人
      const allSorted = [...candidates].sort((a, b) => b.totalWeighted - a.totalWeighted);
      for (let i = 0; i < allSorted.length; i++) {
        if (allSorted[i].candidateId !== winner.candidateId) {
          await prisma.tournamentCandidate.update({
            where: { id: allSorted[i].candidateId },
            data: { rank: i + 1 },
          });
        }
      }

      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: "COMPLETED", winnerId: winner.agentId, finishedAt: new Date() },
      });

      await emitTournamentEvent(tournamentId, "done", {
        winnerId: winner.candidateId,
        winnerSessionId: winner.sessionId,
        winnerName: winner.agent.displayName,
        overallScore,
        dimensionScores: avgDimensions,
        rankings: allSorted.map((c, i) => ({
          rank: i + 1,
          candidateId: c.candidateId,
          sessionId: c.sessionId,
          displayName: c.agent.displayName,
          totalScore: c.totalWeighted,
          eliminated: c.eliminated,
        })),
      });
    }
  } catch (err) {
    console.error("Tournament error:", err);
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "FAILED", finishedAt: new Date() },
    });
    await emitTournamentEvent(tournamentId, "error", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/* ── 对话阶段（破冰/价值观/共情） ── */
async function runDialoguePhase(
  tournamentId: string,
  scenarioKey: ScenarioKey,
  candidates: CandidateRuntime[],
  userAgent: AgentData,
) {
  const roundCount = scenarioKey === "ICEBREAK" ? 3 : scenarioKey === "DEEPVALUE" ? 4 : 5;

  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      // 复用 simulation-engine 的 runScenario
      await runScenario(candidate.sessionId, scenarioKey, userAgent, candidate.agent, roundCount);

      // 获取对话记录用于多维评分
      const round = await prisma.simulationRound.findFirst({
        where: { sessionId: candidate.sessionId, scenario: scenarioKey },
        include: { messages: { orderBy: { seq: "asc" } } },
        orderBy: { createdAt: "desc" },
      });

      if (!round) return;

      const conversation = round.messages.map(m => ({ role: m.role, content: m.content }));
      const multiDim = await judgeRoundMultiDim(scenarioKey, SCENARIOS[scenarioKey].label, conversation);

      // 更新 round 的 scoreDetail
      await prisma.simulationRound.update({
        where: { id: round.id },
        data: { scoreDetail: multiDim.dimensions as unknown as Record<string, number> },
      });

      candidate.scores.push(multiDim);
      candidate.totalWeighted += multiDim.weightedScore;

      await emitTournamentEvent(tournamentId, "candidate_round", {
        candidateId: candidate.candidateId,
        scenario: scenarioKey,
        score: multiDim.weightedScore,
        dimensions: multiDim.dimensions,
        reason: multiDim.reason,
      });
    })
  );

  // 记录失败的候选人
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Candidate ${candidates[i].candidateId} failed in ${scenarioKey}:`, r.reason);
    }
  });
}

/* ── 游戏阶段 ── */
async function runGamePhase(
  tournamentId: string,
  candidates: CandidateRuntime[],
  userAgent: AgentData,
) {
  const questions = GAME_QUESTIONS;

  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      const scenario = SCENARIOS.GAME;

      // 创建 round
      const round = await prisma.simulationRound.create({
        data: {
          sessionId: candidate.sessionId,
          scenario: "GAME",
          score: 0,
          scoreReason: "",
          result: "PENDING",
          roundCount: questions.length,
        },
      });

      let seq = 0;
      const allAnswers: { question: string; agentAAnswer: string; agentBAnswer: string }[] = [];

      for (const q of questions) {
        const questionText = `${q.question}\n选项：${q.options.join("、")}\n请选择一个选项并简要说明理由（2-3句话）。`;

        // Agent A 独立作答
        const aReply = await chatCompletion([
          { role: "system", content: `${userAgent.promptPersona}\n场景：${scenario.system}\n请独立回答以下问题，不要参考他人答案。` },
          { role: "user", content: questionText },
        ]);
        await prisma.roundMessage.create({
          data: { roundId: round.id, role: "AGENT_A", content: aReply, seq: seq++ },
        });

        // Agent B 独立作答
        const bReply = await chatCompletion([
          { role: "system", content: `${candidate.agent.promptPersona}\n场景：${scenario.system}\n请独立回答以下问题，不要参考他人答案。` },
          { role: "user", content: questionText },
        ]);
        await prisma.roundMessage.create({
          data: { roundId: round.id, role: "AGENT_B", content: bReply, seq: seq++ },
        });

        allAnswers.push({ question: q.question, agentAAnswer: aReply, agentBAnswer: bReply });
      }

      // 构造比较对话供评分
      const conversation = allAnswers.flatMap(a => [
        { role: "AGENT_A", content: `[问题: ${a.question}] ${a.agentAAnswer}` },
        { role: "AGENT_B", content: `[问题: ${a.question}] ${a.agentBAnswer}` },
      ]);

      const multiDim = await judgeRoundMultiDim("GAME", scenario.label, conversation);

      await prisma.simulationRound.update({
        where: { id: round.id },
        data: {
          score: multiDim.weightedScore,
          scoreReason: multiDim.reason,
          scoreDetail: multiDim.dimensions as unknown as Record<string, number>,
          result: "PASS",
        },
      });

      candidate.scores.push(multiDim);
      candidate.totalWeighted += multiDim.weightedScore;

      await emitTournamentEvent(tournamentId, "candidate_round", {
        candidateId: candidate.candidateId,
        scenario: "GAME",
        score: multiDim.weightedScore,
        dimensions: multiDim.dimensions,
        reason: multiDim.reason,
      });
    })
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Candidate ${candidates[i].candidateId} failed in GAME:`, r.reason);
    }
  });
}

/* ── 淘汰逻辑 ── */
function eliminateCandidates(candidates: CandidateRuntime[], retainCount: number, phase: string) {
  // 按总加权分排序，保留前 N 名
  const sorted = [...candidates].sort((a, b) => b.totalWeighted - a.totalWeighted);

  for (let i = retainCount; i < sorted.length; i++) {
    sorted[i].eliminated = true;
  }
}

/* ── 辅助函数 ── */
function averageDimensions(dimList: DimensionScores[]): DimensionScores {
  if (dimList.length === 0) return { humor: 0, depth: 0, resonance: 0, compatibility: 0 };
  const sum = dimList.reduce(
    (acc, d) => ({
      humor: acc.humor + d.humor,
      depth: acc.depth + d.depth,
      resonance: acc.resonance + d.resonance,
      compatibility: acc.compatibility + d.compatibility,
    }),
    { humor: 0, depth: 0, resonance: 0, compatibility: 0 },
  );
  const n = dimList.length;
  return {
    humor: Math.round(sum.humor / n),
    depth: Math.round(sum.depth / n),
    resonance: Math.round(sum.resonance / n),
    compatibility: Math.round(sum.compatibility / n),
  };
}

function getDefaultRetain(count: number): number[] {
  // 动态计算淘汰策略：每阶段淘汰约 50%
  const r1 = Math.ceil(count * 0.5);
  const r2 = Math.ceil(r1 * 0.6);
  const r3 = Math.max(Math.ceil(r2 * 0.5), 1);
  return [r1, r2, r3, r3];
}

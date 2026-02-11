"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CandidateSelector from "./_components/CandidateSelector";
import CandidatePool from "./_components/CandidatePool";
import { CandidateInfo } from "./_components/CandidateCard";
import PhaseProgressBar from "./_components/PhaseProgressBar";
import MultiChatLog, { CandidateMessage } from "./_components/MultiChatLog";
import TournamentResult from "./_components/TournamentResult";

/* ── 旧单场模式的类型（保留 fallback） ── */
type OldRoundMessage = { id: string; role: string; content: string; seq: number };
type OldStreamingMessage = { id: string; role: string; content: string; seq: number; scenario: string };
type OldRound = { id: string; scenario: string; score: number; scoreReason: string; result: string; messages: OldRoundMessage[] };
type OldDoneEvent = { status: string; overallScore: number | null; matched: boolean | null; terminateReason: string | null };
type OldOpponent = { displayName: string; mbti: string };

/* ── 锦标赛类型 ── */
type TournamentRanking = {
  rank: number;
  candidateId: string;
  displayName: string;
  mbti: string;
  totalScore: number | null;
  status: string;
};

type TournamentDone = {
  status: "COMPLETED" | "FAILED";
  winnerId: string | null;
  winnerSessionId: string | null;
  rankings: TournamentRanking[];
  dimensionScores?: { humor: number; depth: number; resonance: number; compatibility: number } | null;
};

type Mode = "select" | "classic" | "tournament";
type TournamentPhase = "idle" | "running" | "done";

const SCENARIO_LABELS: Record<string, string> = {
  ICEBREAK: "破冰对话",
  DEEPVALUE: "深度价值观",
  EMPATHY: "共情测试",
  GAME: "默契游戏",
};

const PHASE_KEYS = ["ICEBREAK", "DEEPVALUE", "EMPATHY", "GAME"];

/* ════════════════════════════════════════════════════════
   经典单场模式组件（保留原逻辑）
   ════════════════════════════════════════════════════════ */

function ClassicRadar({ phase, onStart, score }: { phase: "idle" | "scanning" | "done"; onStart: () => void; score: number | null }) {
  const cx = 120, cy = 120;
  const rings = [100, 70, 40];
  return (
    <div className="relative mx-auto mb-8 flex h-[260px] w-[260px] items-center justify-center">
      <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sweepGrad"><stop offset="0%" stopColor="rgba(59,130,246,0)" /><stop offset="100%" stopColor="rgba(59,130,246,0.25)" /></radialGradient>
          <radialGradient id="glowGrad"><stop offset="0%" stopColor="rgba(59,130,246,0.3)" /><stop offset="70%" stopColor="rgba(59,130,246,0.08)" /><stop offset="100%" stopColor="rgba(59,130,246,0)" /></radialGradient>
        </defs>
        <line x1={cx} y1={20} x2={cx} y2={220} stroke="rgba(59,130,246,0.1)" strokeWidth="0.5" />
        <line x1={20} y1={cy} x2={220} y2={cy} stroke="rgba(59,130,246,0.1)" strokeWidth="0.5" />
        {rings.map((r) => (<circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />))}
        {phase === "idle" && (<circle cx={cx} cy={cy} r={90} fill="url(#glowGrad)"><animate attributeName="r" values="70;95;70" dur="3s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" /></circle>)}
        {phase === "scanning" && (
          <g>
            <path d={`M${cx},${cy} L${cx},${cy - 100} A100,100 0 0,1 ${cx + 100 * Math.sin(Math.PI / 3)},${cy - 100 * Math.cos(Math.PI / 3)} Z`} fill="url(#sweepGrad)">
              <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="2.5s" repeatCount="indefinite" />
            </path>
            <line x1={cx} y1={cy} x2={cx} y2={cy - 100} stroke="rgba(59,130,246,0.6)" strokeWidth="1.5">
              <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="2.5s" repeatCount="indefinite" />
            </line>
          </g>
        )}
        {phase === "done" && score != null && (
          <circle cx={cx} cy={cy} r={80} fill="none" stroke={score >= 60 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.2)"} strokeWidth="6" strokeDasharray={`${(score / 100) * 502} 502`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}>
            <animate attributeName="stroke-dasharray" from="0 502" to={`${(score / 100) * 502} 502`} dur="1s" fill="freeze" />
          </circle>
        )}
      </svg>
      {phase === "idle" && (<button onClick={onStart} className="z-10 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all hover:scale-105 active:scale-95">开始匹配</button>)}
      {phase === "scanning" && (<div className="z-10 text-center"><div className="text-lg font-bold text-blue-600">扫描中</div><div className="mt-1 text-xs text-gray-400">Agent 对话进行中...</div></div>)}
      {phase === "done" && (<div className="z-10 text-center">{score != null ? (<><div className={`text-3xl font-black ${score >= 60 ? "text-emerald-500" : "text-gray-500"}`}>{score.toFixed(0)}</div><div className="text-xs text-gray-400">综合评分</div></>) : (<div className="text-lg font-bold text-gray-500">完成</div>)}</div>)}
    </div>
  );
}

function ClassicChatLog({ rounds, liveMessages, logRef }: { rounds: OldRound[]; liveMessages: OldStreamingMessage[]; logRef: React.RefObject<HTMLDivElement | null> }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const roundMsgIds = new Set(rounds.flatMap((r) => r.messages.map((m) => m.id)));
  const pendingMessages = liveMessages.filter((m) => !roundMsgIds.has(m.id));
  const pendingByScenario: Record<string, OldStreamingMessage[]> = {};
  for (const m of pendingMessages) { (pendingByScenario[m.scenario] ??= []).push(m); }
  const hasContent = rounds.length > 0 || pendingMessages.length > 0;
  if (!hasContent) return null;
  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div ref={logRef} className="mb-6 max-h-[520px] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      {rounds.map((round, ri) => {
        const passed = round.score >= 60;
        const isCollapsed = collapsed[round.id] ?? false;
        return (
          <div key={round.id}>
            {ri > 0 && <div className="border-t border-gray-100" />}
            <button type="button" onClick={() => toggle(round.id)} className="sticky top-0 z-10 flex w-full items-center gap-3 border-b border-gray-50 bg-gray-50/80 px-5 py-3 text-left backdrop-blur-sm transition-colors hover:bg-gray-100/80">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${passed ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-600"}`}>{SCENARIO_LABELS[round.scenario] || round.scenario}</span>
              <span className={`text-xs font-medium ${passed ? "text-emerald-500" : "text-red-400"}`}>{round.score} 分</span>
              <span className="ml-auto text-xs text-gray-400">场景 {ri + 1}/3</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-3 px-5 py-4">
                {round.messages.map((msg) => {
                  const isA = msg.role === "AGENT_A";
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isA ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isA ? "bg-blue-500" : "bg-gray-400"}`}>{isA ? "A" : "B"}</div>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isA ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-gray-100 text-gray-800"}`}>
                        <div className={`mb-1 text-[10px] font-medium ${isA ? "text-blue-200" : "text-gray-400"}`}>{isA ? "你的 Agent" : "对方 Agent"}</div>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {Object.entries(pendingByScenario).map(([scenario, msgs]) => (
        <div key={`live-${scenario}`}>
          <div className="border-t border-gray-100" />
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-50 bg-blue-50/80 px-5 py-3 backdrop-blur-sm">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{SCENARIO_LABELS[scenario] || scenario}</span>
            <span className="flex items-center gap-1 text-xs text-blue-500"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />进行中</span>
          </div>
          <div className="space-y-3 px-5 py-4">
            {msgs.map((msg) => {
              const isA = msg.role === "AGENT_A";
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isA ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isA ? "bg-blue-500" : "bg-gray-400"}`}>{isA ? "A" : "B"}</div>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isA ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-gray-100 text-gray-800"}`}>
                    <div className={`mb-1 text-[10px] font-medium ${isA ? "text-blue-200" : "text-gray-400"}`}>{isA ? "你的 Agent" : "对方 Agent"}</div>
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ClassicResultCard({ doneData, sessionId, onRetry }: { doneData: OldDoneEvent; sessionId: string | null; onRetry: () => void }) {
  const matched = doneData.matched;
  const score = doneData.overallScore;
  const circumference = 2 * Math.PI * 54;
  const strokeVal = score != null ? (score / 100) * circumference : 0;
  return (
    <div className={`rounded-2xl border-2 p-8 text-center transition-all ${matched ? "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "border-gray-200 bg-white"}`}>
      {score != null && (
        <div className="relative mx-auto mb-4 h-32 w-32">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke={matched ? "rgba(16,185,129,0.15)" : "rgba(229,231,235,0.5)"} strokeWidth="8" />
            <circle cx="60" cy="60" r="54" fill="none" stroke={matched ? "#10B981" : "#9CA3AF"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${strokeVal} ${circumference}`}>
              <animate attributeName="stroke-dasharray" from={`0 ${circumference}`} to={`${strokeVal} ${circumference}`} dur="1.2s" fill="freeze" />
            </circle>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black ${matched ? "text-emerald-600" : "text-gray-600"}`}>{score.toFixed(0)}</span>
            <span className="text-xs text-gray-400">综合评分</span>
          </div>
        </div>
      )}
      <div className={`mb-1 text-lg font-bold ${matched ? "text-emerald-600" : "text-gray-700"}`}>{matched ? "匹配成功" : "匹配未达标"}</div>
      <div className="mb-6 text-sm text-gray-500">{matched ? "恭喜！你的 Agent 找到了灵魂伴侣" : doneData.terminateReason || "未达到匹配标准，可以再试一次"}</div>
      <div className="flex items-center justify-center gap-3">
        {matched && sessionId && (<a href={`/report/${sessionId}`} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg">查看匹配报告</a>)}
        <button onClick={onRetry} className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all ${matched ? "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" : "bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg"}`}>重新匹配</button>
      </div>
    </div>
  );
}

function ClassicProgressBar({ rounds, phase }: { rounds: OldRound[]; phase: "idle" | "scanning" | "done" }) {
  const scenarios = ["ICEBREAK", "DEEPVALUE", "EMPATHY"];
  const labels = ["破冰", "价值观", "共情"];
  const icons = ["💬", "💎", "❤️"];
  return (
    <div className="mx-auto mb-8 flex w-full max-w-md items-start justify-between">
      {scenarios.map((key, i) => {
        const round = rounds.find((r) => r.scenario === key);
        const active = phase === "scanning" && !round && rounds.length === i;
        const passed = round && round.score >= 60;
        const failed = round && round.score < 60;
        const lineComplete = !!round;
        return (
          <div key={key} className="flex flex-1 items-start">
            <div className="flex flex-col items-center">
              <div className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-500 ${passed ? "border-emerald-400 bg-emerald-50 text-emerald-600" : failed ? "border-red-300 bg-red-50 text-red-500" : active ? "border-blue-400 bg-blue-50 text-blue-600" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
                {active && <span className="absolute inset-0 animate-ping rounded-full border-2 border-blue-300 opacity-40" />}
                {passed ? (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>)
                  : failed ? (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>)
                  : (<span className="text-base">{icons[i]}</span>)}
              </div>
              <span className={`mt-2 text-xs font-medium ${passed ? "text-emerald-600" : failed ? "text-red-500" : active ? "text-blue-600" : "text-gray-400"}`}>{labels[i]}</span>
              {round && <span className={`mt-0.5 text-xs font-semibold ${passed ? "text-emerald-500" : "text-red-400"}`}>{round.score} 分</span>}
            </div>
            {i < scenarios.length - 1 && (
              <div className="mt-6 flex h-[2px] flex-1 items-center px-2">
                <div className="relative h-full w-full overflow-hidden rounded-full bg-gray-200">
                  <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${lineComplete ? (passed ? "bg-emerald-400" : "bg-red-300") : "w-0"}`} style={{ width: lineComplete ? "100%" : "0%" }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   主页面
   ════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const [mode, setMode] = useState<Mode>("select");

  /* ── 经典模式状态 ── */
  const [classicPhase, setClassicPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [classicRounds, setClassicRounds] = useState<OldRound[]>([]);
  const [classicLive, setClassicLive] = useState<OldStreamingMessage[]>([]);
  const [classicDone, setClassicDone] = useState<OldDoneEvent | null>(null);
  const [classicSessionId, setClassicSessionId] = useState<string | null>(null);
  const [classicOpponent, setClassicOpponent] = useState<OldOpponent | null>(null);
  const classicLogRef = useRef<HTMLDivElement>(null);

  /* ── 锦标赛模式状态 ── */
  const [tournamentPhase, setTournamentPhase] = useState<TournamentPhase>("idle");
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateInfo[]>([]);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<string[]>([]);
  const [candidateMessages, setCandidateMessages] = useState<CandidateMessage[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [tournamentDone, setTournamentDone] = useState<TournamentDone | null>(null);
  const [tournamentDimScores, setTournamentDimScores] = useState<{ humor: number; depth: number; resonance: number; compatibility: number } | null>(null);

  // 自动滚动
  useEffect(() => {
    if (classicLogRef.current) classicLogRef.current.scrollTop = classicLogRef.current.scrollHeight;
  }, [classicRounds, classicLive]);

  /* ── 经典模式启动 ── */
  const startClassic = useCallback(async () => {
    setMode("classic");
    setClassicPhase("scanning");
    setClassicRounds([]);
    setClassicLive([]);
    setClassicDone(null);
    setClassicOpponent(null);

    const res = await fetch("/api/simulations", { method: "POST" });
    if (!res.ok) { setClassicPhase("idle"); return; }
    const { sessionId: sid, opponent: opp } = await res.json();
    setClassicSessionId(sid);
    setClassicOpponent(opp);

    const es = new EventSource(`/api/simulations/${sid}/events`);
    es.addEventListener("message", (e) => {
      const msg: OldStreamingMessage = JSON.parse(e.data);
      setClassicLive((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    });
    es.addEventListener("round", (e) => {
      const round: OldRound = JSON.parse(e.data);
      setClassicRounds((prev) => prev.some((r) => r.id === round.id) ? prev : [...prev, round]);
    });
    es.addEventListener("done", (e) => {
      setClassicDone(JSON.parse(e.data));
      setClassicPhase("done");
      es.close();
    });
    es.addEventListener("error", () => { setClassicPhase("done"); es.close(); });
  }, []);

  /* ── 锦标赛模式启动 ── */
  const startTournament = useCallback(async (count: number) => {
    setMode("tournament");
    setTournamentPhase("running");
    setCandidates([]);
    setCandidateMessages([]);
    setCompletedPhases([]);
    setCurrentPhaseIdx(0);
    setTournamentDone(null);
    setTournamentDimScores(null);
    setSelectedCandidateId(null);

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateCount: count }),
    });

    if (!res.ok) { setTournamentPhase("idle"); setMode("select"); return; }

    const data = await res.json();
    setTournamentId(data.tournamentId);

    // 初始化候选人
    const initCandidates: CandidateInfo[] = data.candidates.map((c: { candidateId: string; displayName: string; mbti: string; agentId: string }) => ({
      candidateId: c.candidateId,
      displayName: c.displayName,
      mbti: c.mbti,
      agentId: c.agentId,
      status: "ACTIVE" as const,
    }));
    setCandidates(initCandidates);
    if (initCandidates.length > 0) setSelectedCandidateId(initCandidates[0].candidateId);

    // 连接 SSE
    const es = new EventSource(`/api/tournaments/${data.tournamentId}/events`);

    es.addEventListener("phase_start", (e) => {
      const d = JSON.parse(e.data);
      setCurrentPhaseIdx(d.phase);
    });

    es.addEventListener("candidate_message", (e) => {
      const msg = JSON.parse(e.data);
      setCandidateMessages((prev) => {
        if (prev.some((m) => m.messageId === msg.messageId)) return prev;
        return [...prev, msg];
      });
    });

    es.addEventListener("candidate_round", (e) => {
      const d = JSON.parse(e.data);
      setCandidates((prev) => prev.map((c) =>
        c.candidateId === d.candidateId
          ? { ...c, totalScore: (c.totalScore ?? 0) + (d.score ?? 0), latestScore: d.score, dimensions: d.dimensions }
          : c
      ));
      // 标记阶段完成
      if (d.scenario) {
        setCompletedPhases((prev) => prev.includes(d.scenario) ? prev : [...prev, d.scenario]);
      }
    });

    es.addEventListener("elimination", (e) => {
      const d = JSON.parse(e.data);
      const eliminatedIds = new Set((d.eliminated as { candidateId: string }[]).map((e) => e.candidateId));
      setCandidates((prev) => prev.map((c) =>
        eliminatedIds.has(c.candidateId) ? { ...c, status: "ELIMINATED" as const } : c
      ));
    });

    es.addEventListener("done", (e) => {
      const d = JSON.parse(e.data);
      // 标记冠军
      setCandidates((prev) => prev.map((c) => {
        const ranking = d.rankings?.find((r: TournamentRanking) => r.candidateId === c.candidateId);
        if (ranking) {
          return { ...c, status: ranking.status as CandidateInfo["status"], totalScore: ranking.totalScore ?? c.totalScore };
        }
        return c;
      }));

      setTournamentDone({
        status: d.status || "COMPLETED",
        winnerId: d.winnerId,
        winnerSessionId: d.winnerSessionId || null,
        rankings: d.rankings || [],
        dimensionScores: d.dimensionScores,
      });
      if (d.dimensionScores) setTournamentDimScores(d.dimensionScores);
      setTournamentPhase("done");
      es.close();
    });

    es.addEventListener("error", () => {
      setTournamentPhase("done");
      es.close();
    });
  }, []);

  /* ── 重置回选择界面 ── */
  const handleRetry = useCallback(() => {
    setMode("select");
    setClassicPhase("idle");
    setTournamentPhase("idle");
    setClassicDone(null);
    setTournamentDone(null);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-6 py-10">
      <div className="w-full max-w-3xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-800">
          SoulSync 匹配中心
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          你的 Agent 正在社交网络中寻找灵魂伴侣
        </p>

        {/* ── 模式选择 ── */}
        {mode === "select" && (
          <>
            {/* 锦标赛入口 */}
            <div className="mb-4 text-center">
              <div className="mb-1 text-sm font-semibold text-purple-600">锦标赛模式</div>
              <div className="mb-3 text-xs text-gray-400">多候选淘汰赛，从多个 Agent 中选出最佳匹配</div>
            </div>
            <CandidateSelector onSelect={startTournament} />

            {/* 分割线 */}
            <div className="mx-auto mb-6 flex w-full max-w-sm items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">或</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* 经典模式入口 */}
            <div className="text-center">
              <button
                onClick={startClassic}
                className="rounded-full border border-gray-300 bg-white px-8 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
              >
                经典 1v1 匹配
              </button>
              <div className="mt-2 text-xs text-gray-400">随机匹配一个对手 Agent 进行三场对话</div>
            </div>
          </>
        )}

        {/* ── 经典模式 ── */}
        {mode === "classic" && (
          <>
            <ClassicRadar phase={classicPhase} onStart={startClassic} score={classicDone?.overallScore ?? null} />
            {classicOpponent && classicPhase !== "idle" && (
              <div className="mx-auto mb-6 flex w-full max-w-sm items-center gap-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4 shadow-sm">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">{classicOpponent.displayName.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-800">{classicOpponent.displayName}</div>
                  <div className="mt-0.5 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{classicOpponent.mbti}</div>
                </div>
                <div className="ml-auto text-xs text-gray-400">对手 Agent</div>
              </div>
            )}
            <ClassicProgressBar rounds={classicRounds} phase={classicPhase} />
            <ClassicChatLog rounds={classicRounds} liveMessages={classicLive} logRef={classicLogRef} />
            {classicDone && <ClassicResultCard doneData={classicDone} sessionId={classicSessionId} onRetry={handleRetry} />}
          </>
        )}

        {/* ── 锦标赛模式 ── */}
        {mode === "tournament" && (
          <>
            {/* 进度条 */}
            <PhaseProgressBar
              currentPhaseIndex={currentPhaseIdx}
              completedPhases={completedPhases}
              status={tournamentPhase === "running" ? "running" : tournamentPhase === "done" ? "completed" : "idle"}
            />

            {/* 候选人池 */}
            <CandidatePool
              candidates={candidates}
              selectedId={selectedCandidateId}
              onSelect={setSelectedCandidateId}
            />

            {/* 对话日志 */}
            {candidateMessages.length > 0 && (
              <MultiChatLog
                candidates={candidates.filter(c => c.status !== "ELIMINATED").map(c => ({ candidateId: c.candidateId, displayName: c.displayName }))}
                messages={candidateMessages}
                selectedCandidateId={selectedCandidateId}
                scenarioLabels={SCENARIO_LABELS}
              />
            )}

            {/* 运行中提示 */}
            {tournamentPhase === "running" && candidateMessages.length === 0 && (
              <div className="flex h-40 items-center justify-center">
                <div className="text-center">
                  <div className="mb-2 text-lg font-bold text-blue-600">锦标赛进行中</div>
                  <div className="text-sm text-gray-400">候选 Agent 正在进行对话...</div>
                  <div className="mx-auto mt-3 h-1 w-32 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" style={{ animation: "loading-slide 1.5s ease-in-out infinite" }} />
                  </div>
                </div>
              </div>
            )}

            {/* 锦标赛结果 */}
            {tournamentDone && (
              <TournamentResult
                status={tournamentDone.status}
                winnerId={tournamentDone.winnerId}
                winnerSessionId={tournamentDone.winnerSessionId}
                rankings={tournamentDone.rankings}
                dimensionScores={tournamentDimScores}
                onRetry={handleRetry}
              />
            )}
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

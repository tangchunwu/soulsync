"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

type Message = {
  id: string;
  role: string;
  content: string;
  seq: number;
};

type Round = {
  id: string;
  scenario: string;
  score: number;
  scoreReason: string;
  messages: Message[];
};

type Report = {
  id: string;
  compatibilityScore: number;
  recommendation: string | null;
  session: {
    agentA: { displayName: string; mbti: string };
    agentB: { displayName: string; mbti: string };
    rounds: Round[];
  };
};

/* ── 分数头部 ── */
function ScoreHeader({ report }: { report: Report }) {
  const score = report.compatibilityScore;
  return (
    <div className="mb-6 text-center">
      <h1 className="mb-2 text-2xl font-bold text-gray-800">匹配报告</h1>
      <div className="mx-auto mb-3 flex h-28 w-28 items-center justify-center rounded-full border-4 border-emerald-400 bg-emerald-50">
        <span className="text-3xl font-bold text-emerald-600">
          {score.toFixed(0)}%
        </span>
      </div>
      {report.recommendation && (
        <p className="text-sm text-gray-500">{report.recommendation}</p>
      )}
    </div>
  );
}

/* ── Agent 配对卡片 ── */
function AgentPair({ report }: { report: Report }) {
  const { agentA, agentB } = report.session;
  return (
    <div className="mb-6 flex items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
          {agentA.displayName[0]}
        </div>
        <span className="text-sm font-medium text-gray-700">{agentA.displayName}</span>
        <span className="text-xs text-gray-400">{agentA.mbti}</span>
      </div>
      <div className="text-2xl text-gray-300">x</div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100 text-lg font-bold text-purple-600">
          {agentB.displayName[0]}
        </div>
        <span className="text-sm font-medium text-gray-700">{agentB.displayName}</span>
        <span className="text-xs text-gray-400">{agentB.mbti}</span>
      </div>
    </div>
  );
}

const SCENARIO_LABEL: Record<string, string> = {
  ICEBREAK: "破冰对话",
  DEEPVALUE: "深度价值观",
  EMPATHY: "共情测试",
};

/* ── 对话回放 ── */
function ConversationReplay({ report }: { report: Report }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="mb-6 space-y-3">
      <h2 className="text-sm font-medium text-gray-700">对话回放</h2>
      {report.session.rounds.map((round, idx) => (
        <div key={round.id} className="rounded-xl border border-gray-200 bg-white">
          <button
            onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {SCENARIO_LABEL[round.scenario] || round.scenario}
              </span>
              <span className="text-xs text-gray-400">
                得分 {round.score}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {openIdx === idx ? "收起" : "展开"}
            </span>
          </button>

          {openIdx === idx && (
            <div className="border-t border-gray-100 px-4 py-3">
              {round.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-2 flex ${msg.role === "AGENT_A" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "AGENT_A"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div className="mt-2 text-xs text-gray-400 italic">
                {round.scoreReason}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── 底部操作栏 ── */
function ActionBar() {
  return (
    <div className="flex gap-3">
      <a
        href="/dashboard"
        className="flex-1 rounded-full border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
      >
        返回匹配中心
      </a>
      <button className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
        建立连接
      </button>
    </div>
  );
}

export default function ReportPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/${matchId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setReport(data))
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">报告不存在</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-6 py-10">
      <div className="w-full max-w-2xl">
        <ScoreHeader report={report} />
        <AgentPair report={report} />
        <ConversationReplay report={report} />
        <ActionBar />
      </div>
    </div>
  );
}

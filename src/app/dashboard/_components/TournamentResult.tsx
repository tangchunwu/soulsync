"use client";

import ScoreRadarChart from "./ScoreRadarChart";

interface Ranking {
  rank: number;
  candidateId: string;
  displayName: string;
  mbti: string;
  totalScore: number | null;
  status: string;
}

interface TournamentResultProps {
  status: "COMPLETED" | "FAILED";
  winnerId: string | null;
  winnerSessionId: string | null;
  rankings: Ranking[];
  dimensionScores?: { humor: number; depth: number; resonance: number; compatibility: number } | null;
  onRetry: () => void;
}

export default function TournamentResult({
  status,
  winnerId,
  winnerSessionId,
  rankings,
  dimensionScores,
  onRetry,
}: TournamentResultProps) {
  const winner = rankings.find((r) => r.status === "WINNER") || rankings[0];
  const isSuccess = status === "COMPLETED" && winner;

  return (
    <div
      className={`rounded-2xl border-2 p-8 text-center transition-all ${
        isSuccess
          ? "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white shadow-[0_0_30px_rgba(16,185,129,0.15)]"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* 冠军信息 */}
      {isSuccess && winner && (
        <>
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-white shadow-lg">
            {winner.displayName.charAt(0)}
          </div>
          <div className="mb-1 text-xl font-bold text-emerald-700">
            {winner.displayName}
          </div>
          <div className="mb-1 inline-block rounded bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            {winner.mbti}
          </div>
          <div className="mb-4 text-sm text-gray-500">
            锦标赛冠军 - 综合得分 {winner.totalScore?.toFixed(0) ?? "-"}
          </div>
        </>
      )}

      {/* 雷达图 */}
      {dimensionScores && (
        <div className="mx-auto mb-6 w-fit">
          <ScoreRadarChart scores={dimensionScores} size={180} />
        </div>
      )}

      {/* 排名表 */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="mb-2 text-left text-xs font-semibold text-gray-500">完整排名</div>
        <div className="space-y-1.5">
          {rankings.map((r) => (
            <div
              key={r.candidateId}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                r.status === "WINNER" ? "bg-emerald-100" : "bg-white"
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                r.rank === 1 ? "bg-emerald-500 text-white" :
                r.rank === 2 ? "bg-blue-400 text-white" :
                r.rank === 3 ? "bg-orange-400 text-white" :
                "bg-gray-200 text-gray-600"
              }`}>
                {r.rank}
              </span>
              <span className="flex-1 text-left font-medium text-gray-700">
                {r.displayName}
              </span>
              <span className="text-xs text-gray-400">{r.mbti}</span>
              <span className={`text-xs font-semibold ${
                r.status === "WINNER" ? "text-emerald-600" :
                r.status === "ELIMINATED" ? "text-gray-400" : "text-blue-600"
              }`}>
                {r.totalScore?.toFixed(0) ?? "-"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 状态文案 */}
      {!isSuccess && (
        <div className="mb-4">
          <div className="text-lg font-bold text-gray-700">锦标赛未能完成</div>
          <div className="text-sm text-gray-500">发生了错误，请重试</div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-center gap-3">
        {isSuccess && winner && winnerSessionId && (
          <a
            href={`/report/${winnerSessionId}`}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            查看匹配报告
          </a>
        )}
        <button
          onClick={onRetry}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium transition-all ${
            isSuccess
              ? "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              : "bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重新开始
        </button>
      </div>
    </div>
  );
}

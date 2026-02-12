"use client";

export interface CandidateInfo {
  candidateId: string;
  displayName: string;
  mbti: string;
  agentId: string;
  status: "ACTIVE" | "ELIMINATED" | "WINNER";
  totalScore?: number;
  latestScore?: number;
  dimensions?: { humor: number; depth: number; resonance: number; compatibility: number };
  source?: "REGISTERED" | "BOOK" | "SEED";
}

interface CandidateCardProps {
  candidate: CandidateInfo;
  isSelected?: boolean;
  onClick?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-blue-200 bg-white",
  ELIMINATED: "border-gray-200 bg-gray-50 opacity-60",
  WINNER: "border-emerald-300 bg-emerald-50 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
};

export default function CandidateCard({ candidate, isSelected, onClick }: CandidateCardProps) {
  const initial = candidate.displayName.charAt(0).toUpperCase();
  const statusStyle = STATUS_STYLES[candidate.status] || STATUS_STYLES.ACTIVE;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-36 shrink-0 flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-all hover:shadow-md ${statusStyle} ${
        isSelected ? "ring-2 ring-blue-400 ring-offset-1" : ""
      }`}
    >
      {/* 状态角标 */}
      {candidate.status === "ELIMINATED" && (
        <div className="absolute -right-1 -top-1 rounded-full bg-red-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
          淘汰
        </div>
      )}
      {candidate.status === "WINNER" && (
        <div className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          冠军
        </div>
      )}

      {/* 头像 */}
      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
        candidate.status === "WINNER" ? "bg-emerald-500" :
        candidate.status === "ELIMINATED" ? "bg-gray-400" : "bg-blue-500"
      }`}>
        {initial}
      </div>

      {/* 名称 */}
      <div className="w-full truncate text-center text-xs font-semibold text-gray-800">
        {candidate.displayName}
      </div>

      {/* 来源标签 */}
      {candidate.source === "REGISTERED" && (
        <div className="rounded px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700">
          真实分身
        </div>
      )}
      {candidate.source === "BOOK" && (
        <div className="rounded px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
          模拟对话
        </div>
      )}

      {/* MBTI */}
      <div className={`rounded px-2 py-0.5 text-[10px] font-medium ${
        candidate.status === "ELIMINATED" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-700"
      }`}>
        {candidate.mbti}
      </div>

      {/* 分数 */}
      {candidate.totalScore != null && (
        <div className={`text-xs font-bold ${
          candidate.status === "WINNER" ? "text-emerald-600" :
          candidate.status === "ELIMINATED" ? "text-gray-400" : "text-blue-600"
        }`}>
          {candidate.totalScore.toFixed(0)} 分
        </div>
      )}
    </button>
  );
}

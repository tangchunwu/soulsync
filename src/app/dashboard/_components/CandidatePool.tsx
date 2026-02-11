"use client";

import CandidateCard, { CandidateInfo } from "./CandidateCard";

interface CandidatePoolProps {
  candidates: CandidateInfo[];
  selectedId?: string | null;
  onSelect?: (candidateId: string) => void;
}

export default function CandidatePool({ candidates, selectedId, onSelect }: CandidatePoolProps) {
  if (candidates.length === 0) return null;

  // 排序：WINNER > ACTIVE > ELIMINATED
  const order = { WINNER: 0, ACTIVE: 1, ELIMINATED: 2 };
  const sorted = [...candidates].sort((a, b) => {
    const oa = order[a.status] ?? 1;
    const ob = order[b.status] ?? 1;
    if (oa !== ob) return oa - ob;
    return (b.totalScore ?? 0) - (a.totalScore ?? 0);
  });

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-gray-600">
          候选人 ({candidates.filter(c => c.status === "ACTIVE").length}/{candidates.length} 存活)
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {sorted.map((c) => (
          <CandidateCard
            key={c.candidateId}
            candidate={c}
            isSelected={selectedId === c.candidateId}
            onClick={() => onSelect?.(c.candidateId)}
          />
        ))}
      </div>
    </div>
  );
}

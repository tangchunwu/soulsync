"use client";

interface CandidateSelectorProps {
  onSelect: (count: number) => void;
  disabled?: boolean;
}

const OPTIONS = [
  { count: 3, label: "3 人赛", desc: "快速匹配", icon: "⚡" },
  { count: 5, label: "5 人赛", desc: "均衡体验", icon: "🎯" },
  { count: 10, label: "10 人赛", desc: "深度筛选", icon: "🏆" },
];

export default function CandidateSelector({ onSelect, disabled }: CandidateSelectorProps) {
  return (
    <div className="mx-auto mb-8 w-full max-w-lg">
      <h2 className="mb-4 text-center text-lg font-semibold text-gray-700">
        选择候选人数量
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.count}
            onClick={() => onSelect(opt.count)}
            disabled={disabled}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-5 transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-2xl">{opt.icon}</span>
            <span className="text-sm font-bold text-gray-800">{opt.label}</span>
            <span className="text-xs text-gray-400">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

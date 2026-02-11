"use client";

interface GameScenarioProps {
  answers: {
    candidateId: string;
    displayName: string;
    question: string;
    agentAAnswer: string;
    agentBAnswer: string;
  }[];
}

export default function GameScenario({ answers }: GameScenarioProps) {
  if (answers.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-purple-200 bg-gradient-to-b from-purple-50 to-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-purple-700">
        <span className="text-base">🎮</span>
        默契问答结果
      </h3>
      <div className="space-y-4">
        {answers.map((a, i) => (
          <div key={i} className="rounded-xl border border-purple-100 bg-white p-4">
            <div className="mb-3 text-sm font-medium text-gray-700">
              Q{i + 1}: {a.question}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <div className="mb-1 text-[10px] font-semibold text-blue-600">你的 Agent</div>
                <div className="text-xs leading-relaxed text-gray-700">{a.agentAAnswer}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1 text-[10px] font-semibold text-gray-500">{a.displayName}</div>
                <div className="text-xs leading-relaxed text-gray-700">{a.agentBAnswer}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

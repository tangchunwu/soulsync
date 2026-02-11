"use client";

const PHASES = [
  { key: "ICEBREAK", label: "破冰", icon: "💬" },
  { key: "DEEPVALUE", label: "价值观", icon: "💎" },
  { key: "EMPATHY", label: "共情", icon: "❤️" },
  { key: "GAME", label: "游戏", icon: "🎮" },
];

interface PhaseProgressBarProps {
  currentPhaseIndex: number;
  completedPhases: string[];
  status: "idle" | "running" | "completed" | "failed";
}

export default function PhaseProgressBar({ currentPhaseIndex, completedPhases, status }: PhaseProgressBarProps) {
  return (
    <div className="mx-auto mb-8 flex w-full max-w-xl items-start justify-between">
      {PHASES.map((phase, i) => {
        const completed = completedPhases.includes(phase.key);
        const active = status === "running" && currentPhaseIndex === i;
        const upcoming = !completed && !active;

        const lineComplete = completed;

        return (
          <div key={phase.key} className="flex flex-1 items-start">
            <div className="flex flex-col items-center">
              <div
                className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-500 ${
                  completed
                    ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                    : active
                      ? "border-blue-400 bg-blue-50 text-blue-600"
                      : "border-gray-200 bg-gray-50 text-gray-400"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full border-2 border-blue-300 opacity-40" />
                )}
                {completed ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-base">{phase.icon}</span>
                )}
              </div>
              <span className={`mt-2 text-xs font-medium ${
                completed ? "text-emerald-600" : active ? "text-blue-600" : "text-gray-400"
              }`}>
                {phase.label}
              </span>
            </div>

            {i < PHASES.length - 1 && (
              <div className="mt-6 flex h-[2px] flex-1 items-center px-2">
                <div className="relative h-full w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                      lineComplete ? "bg-emerald-400" : "w-0"
                    }`}
                    style={{ width: lineComplete ? "100%" : "0%" }}
                  />
                  {active && (
                    <div
                      className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-blue-400 opacity-50"
                      style={{ animation: "phase-pulse 1.5s ease-in-out infinite" }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <style jsx>{`
        @keyframes phase-pulse {
          0%, 100% { width: 10%; opacity: 0.3; }
          50% { width: 60%; opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

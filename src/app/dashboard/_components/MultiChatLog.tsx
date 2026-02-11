"use client";

import { useState } from "react";

export interface CandidateMessage {
  candidateId: string;
  displayName: string;
  scenario: string;
  messageId: string;
  role: string;
  content: string;
  seq: number;
}

interface MultiChatLogProps {
  candidates: { candidateId: string; displayName: string }[];
  messages: CandidateMessage[];
  selectedCandidateId: string | null;
  scenarioLabels: Record<string, string>;
}

export default function MultiChatLog({
  candidates,
  messages,
  selectedCandidateId,
  scenarioLabels,
}: MultiChatLogProps) {
  const [activeTab, setActiveTab] = useState<string | null>(selectedCandidateId);
  const currentTab = activeTab || candidates[0]?.candidateId || null;

  const filtered = messages.filter((m) => m.candidateId === currentTab);

  // 按场景分组
  const byScenario: Record<string, CandidateMessage[]> = {};
  for (const m of filtered) {
    (byScenario[m.scenario] ??= []).push(m);
  }

  if (candidates.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* 标签页 */}
      <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50">
        {candidates.map((c) => {
          const isActive = currentTab === c.candidateId;
          const msgCount = messages.filter((m) => m.candidateId === c.candidateId).length;
          return (
            <button
              key={c.candidateId}
              onClick={() => setActiveTab(c.candidateId)}
              className={`shrink-0 px-4 py-2.5 text-xs font-medium transition-all ${
                isActive
                  ? "border-b-2 border-blue-500 bg-white text-blue-600"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {c.displayName}
              {msgCount > 0 && (
                <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-600">
                  {msgCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 对话内容 */}
      <div className="max-h-[480px] overflow-y-auto">
        {Object.keys(byScenario).length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            等待对话开始...
          </div>
        ) : (
          Object.entries(byScenario).map(([scenario, msgs]) => (
            <div key={scenario}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-50 bg-blue-50/80 px-5 py-2 backdrop-blur-sm">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {scenarioLabels[scenario] || scenario}
                </span>
                <span className="text-xs text-gray-400">{msgs.length} 条消息</span>
              </div>
              <div className="space-y-3 px-5 py-4">
                {msgs.map((msg) => {
                  const isA = msg.role === "AGENT_A";
                  return (
                    <div key={msg.messageId} className={`flex items-end gap-2 ${isA ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                        isA ? "bg-blue-500" : "bg-gray-400"
                      }`}>
                        {isA ? "你" : msg.displayName.charAt(0)}
                      </div>
                      <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        isA
                          ? "rounded-br-md bg-blue-600 text-white"
                          : "rounded-bl-md bg-gray-100 text-gray-800"
                      }`}>
                        <div className={`mb-0.5 text-[10px] font-medium ${isA ? "text-blue-200" : "text-gray-400"}`}>
                          {isA ? "你的 Agent" : msg.displayName}
                        </div>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

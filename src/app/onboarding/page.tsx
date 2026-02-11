"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mbti, setMbti] = useState("");
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!mbti || !intent.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mbti, intent }),
      });
      if (res.ok) {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg">
        {/* 步骤指示器 */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className={`h-2 w-12 rounded-full ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`} />
          <div className={`h-2 w-12 rounded-full ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
        </div>

        {step === 1 && (
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-2xl font-bold text-gray-800">选择你的性格类型</h2>
            <p className="text-sm text-gray-500">这将帮助 Agent 理解你的沟通风格</p>
            <div className="grid grid-cols-4 gap-3">
              {MBTI_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setMbti(type)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                    mbti === type
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <button
              onClick={() => mbti && setStep(2)}
              disabled={!mbti}
              className="mt-4 h-11 w-full rounded-full bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              下一步
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-2xl font-bold text-gray-800">描述你的意图</h2>
            <p className="text-sm text-gray-500">告诉 Agent 你想找什么样的人</p>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="例如：我是一个创业者，最近压力很大，想找一个情绪稳定的伴侣，最好懂一点艺术..."
              className="h-40 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex w-full gap-3">
              <button
                onClick={() => setStep(1)}
                className="h-11 flex-1 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                上一步
              </button>
              <button
                onClick={handleSubmit}
                disabled={!intent.trim() || loading}
                className="h-11 flex-1 rounded-full bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
              >
                {loading ? "创建中..." : "完成并开始匹配"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

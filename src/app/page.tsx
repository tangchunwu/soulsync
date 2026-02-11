export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <main className="flex flex-col items-center gap-12 px-6 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-800">
            SoulSync
          </h1>
          <p className="text-lg text-gray-500">
            A2A 深度意图匹配协议
          </p>
        </div>

        {/* Tagline */}
        <p className="max-w-md text-base leading-7 text-gray-600">
          让你的 Agent 替你完成 90% 的社交筛选，
          <br />
          你只需享受最契合的 10%。
        </p>

        {/* Login Button */}
        <a
          href="/api/auth/login"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-blue-600 px-8 text-base font-medium text-white transition-colors hover:bg-blue-700"
        >
          使用 SecondMe 登录
        </a>

        {/* Footer hint */}
        <p className="text-sm text-gray-400">
          授权登录后，AI Agent 将为你寻找灵魂契合的人
        </p>
      </main>
    </div>
  );
}

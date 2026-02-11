# SoulSync MVP 实施计划

## 项目概述

**产品名称**：SoulSync - A2A 深度意图匹配协议
**核心理念**：Let your Agent live the 90%, you enjoy the top 10%
**项目目录**：`/Users/tangchunwu/soulsync`

用户授权 SecondMe 登录后，Agent 携带用户人格（MBTI/意图）进入模拟网络，与其他 Agent 进行场景化对话，自动筛选匹配对象，生成匹配报告。

---

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 框架 | Next.js 14+ (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | PostgreSQL + Prisma |
| LLM | 兼容 OpenAI 接口的模型 |
| 认证 | SecondMe OAuth2 |
| 状态管理 | Zustand |

---

## 凭证信息

- **Client ID**: `91665f57-8f18-4d43-93f7-7643a862a1ed`
- **Client Secret**: `3b87238170d3da6781d78b5623f76f9b0fbc73e568a8eb99c8606b552f77b754`
- **Redirect URI**: `http://localhost:3000/api/auth/callback`
- **API Base URL**: `https://app.mindos.com/gate/lab`
- **OAuth URL**: `https://go.second.me/oauth/`
- **Token Endpoint**: `https://app.mindos.com/gate/lab/api/oauth/token/code`

---

## SESSION_ID

- **CODEX_SESSION**: `019c47c1-b6f8-7c11-860f-fad102cfe18e`
- **GEMINI_SESSION**: `a7db4a7c-9d83-4ff3-8a2f-63b165b581c3`

---

## 项目目录结构

```
soulsync/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 根布局
│   │   ├── page.tsx                      # 登录页 /
│   │   ├── onboarding/
│   │   │   └── page.tsx                  # 灵魂注入页 /onboarding
│   │   ├── dashboard/
│   │   │   ├── page.tsx                  # 模拟仪表盘 /dashboard
│   │   │   └── loading.tsx
│   │   ├── report/
│   │   │   └── [matchId]/
│   │   │       ├── page.tsx              # 匹配报告 /report/:matchId
│   │   │       └── loading.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts        # OAuth 登录跳转
│   │       │   ├── callback/route.ts     # OAuth 回调
│   │       │   └── logout/route.ts       # 登出
│   │       ├── user/
│   │       │   ├── info/route.ts         # 代理 SecondMe 用户信息
│   │       │   └── shades/route.ts       # 代理兴趣标签
│   │       ├── agents/
│   │       │   └── route.ts              # Agent 列表/创建
│   │       ├── simulations/
│   │       │   ├── route.ts              # 创建模拟任务
│   │       │   ├── [id]/route.ts         # 查询模拟状态
│   │       │   └── [id]/events/route.ts  # SSE 进度推送
│   │       └── reports/
│   │           └── [simulationId]/route.ts
│   ├── components/
│   │   ├── ui/                           # 原子组件
│   │   │   ├── Button.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Skeleton.tsx
│   │   └── features/                     # 业务组件
│   │       ├── MbtiSelector.tsx
│   │       ├── IntentForm.tsx
│   │       ├── RadarScan.tsx
│   │       ├── ChatLog.tsx
│   │       ├── MatchCard.tsx
│   │       └── ConversationReplay.tsx
│   ├── lib/
│   │   ├── prisma.ts                     # Prisma 客户端
│   │   ├── auth.ts                       # 认证工具
│   │   ├── secondme.ts                   # SecondMe API 客户端
│   │   ├── llm.ts                        # OpenAI 兼容 LLM 客户端
│   │   ├── simulation-engine.ts          # A2A 模拟引擎
│   │   ├── scoring.ts                    # 评分逻辑
│   │   └── prompt-templates.ts           # Prompt 模板
│   ├── store/
│   │   ├── onboarding.ts                 # Onboarding 状态
│   │   └── dashboard.ts                  # Dashboard 实时状态
│   └── types/
│       └── index.ts                      # 全局类型定义
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                           # 预埋虚拟 Agent
├── .env.local
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 数据库设计 (Prisma Schema)

### User 表 - 存储登录用户和 Token

```prisma
model User {
  id              String   @id @default(cuid())
  secondmeUserId  String   @unique
  email           String?
  name            String?
  avatarUrl       String?
  accessToken     String
  refreshToken    String
  tokenExpiresAt  DateTime
  mbti            String?
  intent          String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  agent           AgentProfile?
  simulations     SimulationSession[]
  reports         MatchReport[]
}
```

### AgentProfile 表 - 用户 Agent 和预埋虚拟 Agent

```prisma
model AgentProfile {
  id            String  @id @default(cuid())
  userId        String? @unique
  source        String  @default("USER")  // USER | SEED
  displayName   String
  avatarUrl     String?
  mbti          String
  traits        Json?
  intent        String?
  promptPersona String  @db.Text
  isActive      Boolean @default(true)
  createdAt     DateTime @default(now())

  user          User?   @relation(fields: [userId], references: [id])
  sessionsAsA   SimulationSession[] @relation("AgentA")
  sessionsAsB   SimulationSession[] @relation("AgentB")
}
```

### SimulationSession 表 - 一次完整的 A2A 模拟

```prisma
model SimulationSession {
  id              String   @id @default(cuid())
  userId          String
  agentAId        String
  agentBId        String
  status          String   @default("QUEUED")  // QUEUED|RUNNING|COMPLETED|TERMINATED
  overallScore    Float?
  matched         Boolean?
  terminateReason String?
  startedAt       DateTime?
  finishedAt      DateTime?
  createdAt       DateTime @default(now())

  user    User          @relation(fields: [userId], references: [id])
  agentA  AgentProfile  @relation("AgentA", fields: [agentAId], references: [id])
  agentB  AgentProfile  @relation("AgentB", fields: [agentBId], references: [id])
  rounds  SimulationRound[]
  report  MatchReport?
}
```

### SimulationRound 表 - 每个场景的对话轮次

```prisma
model SimulationRound {
  id          String   @id @default(cuid())
  sessionId   String
  scenario    String   // ICEBREAK | DEEPVALUE | EMPATHY
  score       Int
  scoreReason String?  @db.Text
  result      String   @default("PASS")  // PASS | STOP_LOW_SCORE
  createdAt   DateTime @default(now())

  session   SimulationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  messages  RoundMessage[]
}
```

### RoundMessage 表 - Agent 对话消息

```prisma
model RoundMessage {
  id        String   @id @default(cuid())
  roundId   String
  role      String   // AGENT_A | AGENT_B | JUDGE
  content   String   @db.Text
  seq       Int
  createdAt DateTime @default(now())

  round SimulationRound @relation(fields: [roundId], references: [id], onDelete: Cascade)
}
```

### MatchReport 表 - 匹配报告

```prisma
model MatchReport {
  id                 String   @id @default(cuid())
  sessionId          String   @unique
  userId             String
  compatibilityScore Float
  highlights         Json?
  recommendation     String?  @db.Text
  createdAt          DateTime @default(now())

  session SimulationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user    User              @relation(fields: [userId], references: [id])
}
```

---

## API 路由设计

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/login` | 生成 OAuth 授权 URL，302 跳转到 SecondMe |
| GET | `/api/auth/callback?code=xxx` | 用 code 换 token，创建用户，设置 cookie |
| POST | `/api/auth/logout` | 清除 session cookie |

### SecondMe 代理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/info` | 代理获取用户信息 |
| GET | `/api/user/shades` | 代理获取兴趣标签 |

### 业务接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agents` | 创建用户 Agent（提交 MBTI + 意图） |
| GET | `/api/agents` | 获取 Agent 池列表（含 SEED） |
| POST | `/api/simulations` | 启动模拟任务 |
| GET | `/api/simulations/[id]` | 查询模拟状态和进度 |
| GET | `/api/simulations/[id]/events` | SSE 实时推送模拟进度 |
| GET | `/api/reports/[simulationId]` | 获取匹配报告详情 |

---

## A2A 模拟引擎核心流程

```
用户点击"开始匹配"
       │
       ▼
POST /api/simulations（创建任务，状态 QUEUED）
       │
       ▼
遍历 Agent 池中的候选 Agent（5-10 个 SEED）
       │
       ▼
┌──────────────────────────────┐
│  场景 A：破冰（兴趣与审美）   │
│  Agent A ↔ Agent B 对话 2-4轮│
│  裁判 LLM 评分 0-100         │
│  < 60 → 终止，换下一个       │
│  ≥ 60 → 进入场景 B           │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  场景 B：深度（价值观/金钱观） │
│  同上流程                     │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  场景 C：共情（压力下的反应）  │
│  同上流程                     │
└──────────────────────────────┘
       │
       ▼
3 轮全部 ≥ 60 → 计算综合分 → 生成 MatchReport
```

### LLM 调用方式

- 使用兼容 OpenAI 接口的模型（`/v1/chat/completions`）
- Agent 对话：两个 System Prompt 分别代表 Agent A 和 Agent B，交替生成回复
- 裁判评分：将对话记录整体提交给 LLM，要求输出 JSON `{"score": 85, "reason": "..."}`

---

## 分步实施计划

### Step 1：项目初始化（后端）

- `npx create-next-app@latest . --typescript --tailwind --app --src-dir --yes`
- 安装依赖：`prisma @prisma/client zustand openai`
- 生成 `.env.local`（凭证、数据库、LLM 配置）
- 生成 `prisma/schema.prisma`（上述 6 张表）
- `npx prisma db push`
- **验证**：`npm run build` 通过

### Step 2：OAuth 认证（后端）

- 实现 `src/lib/auth.ts`（cookie 读写、token 管理）
- 实现 `src/lib/secondme.ts`（SecondMe API 客户端）
- 实现 `/api/auth/login`、`/api/auth/callback`、`/api/auth/logout`
- 实现 `/api/user/info`、`/api/user/shades`
- **验证**：浏览器点击登录 → 跳转 SecondMe → 回调成功 → 显示用户信息

### Step 3：登录页 UI（前端）

- 实现 `src/app/page.tsx`（Landing Page）
- 产品标题、简介文案、SecondMe 登录按钮
- 亮色、极简、未来感风格
- **验证**：页面渲染正常，点击登录跳转成功

### Step 4：灵魂注入页（前端 + 后端）

- 实现 `src/app/onboarding/page.tsx`
- MBTI 选择器（16 种卡片）
- 意图输入大文本框
- 实现 `POST /api/agents`（保存 MBTI + 意图，生成 Agent promptPersona）
- 实现 `src/lib/prompt-templates.ts`（Agent 人设 Prompt 模板）
- **验证**：选择 MBTI → 输入意图 → 提交 → Agent 创建成功

### Step 5：模拟引擎（后端核心）

- 实现 `prisma/seed.ts`（预埋 5-10 个虚拟 Agent）
- 实现 `src/lib/llm.ts`（OpenAI 兼容客户端）
- 实现 `src/lib/simulation-engine.ts`（3 场景对话编排）
- 实现 `src/lib/scoring.ts`（裁判评分逻辑）
- 实现 `POST /api/simulations`（创建并执行模拟）
- 实现 `GET /api/simulations/[id]`（查询状态）
- 实现 `GET /api/simulations/[id]/events`（SSE 推送）
- **验证**：调用 API → 后台 Agent 对话日志正确 → 评分和终止逻辑正常

### Step 6：模拟仪表盘（前端）

- 实现 `src/app/dashboard/page.tsx`
- 雷达扫描动画（CSS 动画）
- 实时进度数字（已扫描/深度模拟/匹配成功）
- 对话日志实时展示（SSE 接收 → 聊天气泡）
- **验证**：点击开始 → 动画运行 → 日志实时刷新 → 匹配完成跳转

### Step 7：匹配报告页（前端 + 后端）

- 实现 `GET /api/reports/[simulationId]`
- 实现 `src/app/report/[matchId]/page.tsx`
- 匹配卡片（头像、匹配度、摘要）
- 对话回放时间线
- "建立连接"按钮
- **验证**：报告页数据正确渲染，对话回放可查看

---

## 任务路由

| Step | 类型 | 模型路由 |
|------|------|---------|
| 1 | 后端 | Codex |
| 2 | 后端 | Codex |
| 3 | 前端 | Gemini |
| 4 | 全栈 | Codex + Gemini 并行 |
| 5 | 后端 | Codex |
| 6 | 前端 | Gemini |
| 7 | 全栈 | Codex + Gemini 并行 |

---

## 配色方案

| 角色 | 颜色 | Tailwind |
|------|------|---------|
| 背景 | 极浅灰 | `bg-gray-50` |
| 表面 | 纯白 | `bg-white` |
| 主文本 | 深灰 | `text-gray-800` |
| 次文本 | 中灰 | `text-gray-500` |
| 边框 | 浅灰 | `border-gray-200` |
| 主强调色 | 电光蓝 | `bg-blue-600` |
| 成功 | 薄荷绿 | `bg-emerald-500` |

# SoulSync

让 AI Agent 替你找到灵魂伴侣。

SoulSync 是一个基于 AI Agent 的社交匹配平台。你创建一个代表自己性格的 Agent，它会自动和其他 Agent 聊天、互动、做默契测试，最终帮你筛选出最合拍的人。

## 它是怎么工作的

1. 登录后填写你的 MBTI 和社交意图，系统会生成一个专属 Agent
2. 选择匹配模式：
   - **经典 1v1** — 你的 Agent 和一个随机对手进行三场对话（破冰、价值观、共情）
   - **锦标赛模式** — 选 3/5/10 个候选人，四阶段淘汰赛，最终决出最佳匹配
3. 全程实时观看 Agent 之间的对话，看它们怎么替你"相亲"
4. 匹配完成后查看详细报告和四维评分雷达图

## 锦标赛四个阶段

| 阶段 | 内容 | 说明 |
|------|------|------|
| 破冰 | 聊兴趣爱好、审美偏好 | 淘汰约一半候选人 |
| 价值观 | 聊人生目标、金钱观、家庭观 | 继续淘汰 |
| 共情 | 压力场景下的情绪回应 | 留下最后 1-2 人 |
| 默契游戏 | 5 道情境选择题，独立作答后比较 | 决出冠军 |

每个阶段从四个维度打分：幽默感、深度、共鸣、兼容性。

## 技术栈

- Next.js 16 + React 19 + TypeScript
- Prisma + SQLite
- OpenAI 兼容 LLM API
- Tailwind CSS
- SSE 实时推送

## 本地运行

运行这个项目之前，你需要先准备两样东西：一个大模型 API 和一个 SecondMe 账号。下面会教你怎么搞。

### 第一步：准备大模型 API

项目需要调用大语言模型来驱动 Agent 对话和评分。任何兼容 OpenAI 接口格式的服务都行，推荐以下几个：

| 服务商 | 注册地址 | 推荐模型 | 说明 |
|--------|----------|----------|------|
| SiliconFlow（硅基流动） | https://siliconflow.cn | `Pro/moonshotai/Kimi-K2.5` | 国内可直连，注册送额度 |
| OpenAI | https://platform.openai.com | `gpt-4o-mini` | 需要海外信用卡 |
| DeepSeek | https://platform.deepseek.com | `deepseek-chat` | 国内可直连，价格便宜 |

注册后在平台的「API Keys」页面创建一个密钥，记下来，后面要填到环境变量里。

### 第二步：准备 SecondMe 账号

SoulSync 使用 [Second Me](https://second.me) 作为用户登录系统。你需要：

1. 访问 https://second.me 注册一个账号
2. 在开发者设置中创建一个 OAuth 应用
3. 回调地址填 `http://localhost:3000/api/auth/callback`
4. 创建完成后你会拿到 `Client ID` 和 `Client Secret`

### 第三步：安装和启动

```bash
# 克隆项目
git clone https://github.com/tangchunwu/soulsync.git
cd soulsync

# 安装依赖
npm install

# 复制环境变量模板
cp .env.example .env.local
```

然后打开 `.env.local`，把刚才拿到的密钥填进去：

```bash
# 填你的大模型 API 信息
LLM_BASE_URL=https://api.siliconflow.cn/v1     # 换成你用的服务商地址
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx                 # 换成你的 API Key
LLM_MODEL=Pro/moonshotai/Kimi-K2.5              # 换成你想用的模型

# 填你的 SecondMe OAuth 信息
SECONDME_CLIENT_ID=你的-client-id
SECONDME_CLIENT_SECRET=你的-client-secret
```

其他变量一般不用改。然后继续：

```bash
# 初始化数据库并填充测试数据
npx prisma migrate dev
npx prisma db seed

# 启动
npm run dev
```

打开 http://localhost:3000 ，点击登录，用 SecondMe 账号授权后就能开始匹配了。

## 全部环境变量说明

| 变量 | 说明 | 必填 |
|------|------|------|
| `DATABASE_URL` | 数据库连接，默认不用改 | 已有默认值 |
| `LLM_BASE_URL` | 大模型 API 地址 | 是 |
| `LLM_API_KEY` | 大模型 API 密钥 | 是 |
| `LLM_MODEL` | 模型名称（默认 `gpt-4o-mini`） | 否 |
| `SECONDME_API_BASE_URL` | SecondMe API 地址 | 是 |
| `SECONDME_OAUTH_URL` | SecondMe OAuth 授权页地址 | 是 |
| `SECONDME_TOKEN_ENDPOINT` | SecondMe OAuth Token 接口 | 是 |
| `SECONDME_CLIENT_ID` | SecondMe OAuth Client ID | 是 |
| `SECONDME_CLIENT_SECRET` | SecondMe OAuth Client Secret | 是 |
| `SECONDME_REDIRECT_URI` | OAuth 回调地址，默认不用改 | 已有默认值 |

## 项目结构

```
src/
├── app/
│   ├── dashboard/          # 匹配中心主页面 + 组件
│   ├── report/             # 匹配报告页
│   ├── onboarding/         # 新用户引导
│   └── api/                # 后端 API
│       ├── tournaments/    # 锦标赛相关
│       ├── simulations/    # 单场匹配相关
│       └── auth/           # 登录认证
└── lib/
    ├── tournament-engine.ts  # 锦标赛引擎
    ├── simulation-engine.ts  # 单场对话引擎
    ├── scoring.ts            # 四维评分系统
    ├── prompt-templates.ts   # 场景和人设模板
    └── llm.ts                # LLM 调用封装
```

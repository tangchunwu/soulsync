import { PrismaClient } from "@prisma/client";
import { buildAgentPersona } from "../src/lib/prompt-templates";

const prisma = new PrismaClient();

const SEED_AGENTS = [
  {
    displayName: "温柔的艺术家",
    mbti: "INFP",
    intent: "寻找能理解创作灵感的伴侣",
    traits: { style: "温柔", hobby: "绘画、写作" },
  },
  {
    displayName: "理性的创业者",
    mbti: "ENTJ",
    intent: "寻找事业上的灵魂伴侣",
    traits: { style: "果断", hobby: "商业、科技" },
  },
  {
    displayName: "暴躁的老板",
    mbti: "ESTJ",
    intent: "找一个听话的人",
    traits: { style: "强势", hobby: "高尔夫、红酒" },
  },
  {
    displayName: "佛系的程序员",
    mbti: "INTP",
    intent: "找一个不打扰我写代码的人",
    traits: { style: "内向", hobby: "编程、游戏" },
  },
  {
    displayName: "热情的旅行家",
    mbti: "ENFP",
    intent: "找一个一起环游世界的伙伴",
    traits: { style: "热情", hobby: "旅行、摄影" },
  },
];

async function main() {
  for (const agent of SEED_AGENTS) {
    const persona = buildAgentPersona(agent.mbti, agent.intent, agent.displayName);
    await prisma.agentProfile.create({
      data: {
        source: "SEED",
        displayName: agent.displayName,
        mbti: agent.mbti,
        intent: agent.intent,
        traits: agent.traits,
        promptPersona: persona,
      },
    });
  }
  console.log(`Seeded ${SEED_AGENTS.length} agents`);
}

main().finally(() => prisma.$disconnect());

export function buildAgentPersona(mbti: string, intent: string, name: string) {
  return `你叫 ${name}。你的性格类型是 ${mbti}。
你的主人当前意图：${intent}
你正在替主人筛选社交对象。你的沟通风格必须符合 ${mbti} 的性格特征。
如果对方表现出与主人意图不符的特质，礼貌结束对话并标记为不匹配。
如果对方表现出契合，深入了解对方。`;
}

export const SCENARIOS = {
  ICEBREAK: {
    label: "破冰：兴趣与审美",
    system: "这是一场轻松的破冰对话。双方聊兴趣爱好、审美偏好、日常生活。目标是发现共同点。",
  },
  DEEPVALUE: {
    label: "深度：价值观与金钱观",
    system: "这是一场深度对话。双方讨论人生目标、金钱观、事业规划、家庭观念。目标是检验价值观是否契合。",
  },
  EMPATHY: {
    label: "共情：压力下的反应",
    system: "这是一场压力测试对话。一方描述自己遇到的困难或压力，另一方回应。目标是检验共情能力和情绪稳定性。",
  },
  GAME: {
    label: "默契游戏：情境选择",
    system: "这是一场默契问答游戏。双方需要独立回答情境选择题，然后比较答案。目标是检验双方的默契程度和思维相似性。",
  },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

export const GAME_QUESTIONS = [
  {
    id: 1,
    question: "周末早上醒来，外面下着雨，你最想做什么？",
    options: ["A. 窝在床上看电影", "B. 去咖啡馆看书", "C. 约朋友打游戏", "D. 在家做一顿丰盛的早餐"],
  },
  {
    id: 2,
    question: "如果突然获得一笔意外之财（10万元），你会怎么用？",
    options: ["A. 存起来或投资", "B. 来一次说走就走的旅行", "C. 给家人和朋友买礼物", "D. 提升自己（课程/设备）"],
  },
  {
    id: 3,
    question: "伴侣加班到很晚才回家，你的第一反应是？",
    options: ["A. 先准备好热饭等ta", "B. 发消息问安但不打扰", "C. 有点生气但不说", "D. 直接打电话确认情况"],
  },
  {
    id: 4,
    question: "你们在看法上产生了分歧，你倾向于？",
    options: ["A. 摆事实讲道理说服对方", "B. 先倾听再表达自己", "C. 各自保留意见不争", "D. 找第三方来评判"],
  },
  {
    id: 5,
    question: "如果可以拥有一种超能力，你会选？",
    options: ["A. 读心术", "B. 时间暂停", "C. 瞬间移动", "D. 治愈能力"],
  },
];

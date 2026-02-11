import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // 轮询数据库状态，推送进度
      let finished = false;
      let lastRoundCount = 0;
      let lastMessageCount = 0;

      while (!finished) {
        const session = await prisma.simulationSession.findUnique({
          where: { id, userId: user.id },
          include: {
            rounds: {
              include: { messages: { orderBy: { seq: "asc" } } },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (!session) {
          send("error", { message: "会话不存在" });
          finished = true;
          break;
        }

        // 推送逐条新消息（跨所有 round 累计计数）
        const allMessages = session.rounds.flatMap((r) =>
          r.messages.map((m) => ({ ...m, scenario: r.scenario }))
        );
        if (allMessages.length > lastMessageCount) {
          for (let i = lastMessageCount; i < allMessages.length; i++) {
            send("message", allMessages[i]);
          }
          lastMessageCount = allMessages.length;
        }

        // 推送已完成评分的 round（score > 0 且 result !== PENDING）
        const completedRounds = session.rounds.filter((r) => r.result !== "PENDING");
        if (completedRounds.length > lastRoundCount) {
          for (let i = lastRoundCount; i < completedRounds.length; i++) {
            send("round", completedRounds[i]);
          }
          lastRoundCount = completedRounds.length;
        }

        // 检查是否结束
        if (session.status === "COMPLETED" || session.status === "TERMINATED") {
          send("done", {
            status: session.status,
            overallScore: session.overallScore,
            matched: session.matched,
            terminateReason: session.terminateReason,
          });
          finished = true;
          break;
        }

        // 缩短轮询间隔，更快推送消息
        await new Promise((r) => setTimeout(r, 1000));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

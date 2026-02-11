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

      let finished = false;
      let lastPhaseTs = 0;
      let sentMessageIds = new Set<string>();
      let sentRoundIds = new Set<string>();

      while (!finished) {
        const tournament = await prisma.tournament.findUnique({
          where: { id, userId: user.id },
          include: {
            candidates: {
              include: {
                agent: true,
                sessions: {
                  include: {
                    rounds: {
                      include: { messages: { orderBy: { seq: "asc" } } },
                      orderBy: { createdAt: "asc" },
                    },
                  },
                },
              },
            },
          },
        });

        if (!tournament) {
          send("error", { message: "锦标赛不存在" });
          finished = true;
          break;
        }

        // 解析 currentPhase 中的事件
        if (tournament.currentPhase) {
          try {
            const phaseEvent = JSON.parse(tournament.currentPhase);
            if (phaseEvent.ts > lastPhaseTs) {
              lastPhaseTs = phaseEvent.ts;
              send(phaseEvent.event, phaseEvent.data);
            }
          } catch {
            // 忽略解析失败
          }
        }

        // 推送各候选人的新消息和已完成 round
        for (const candidate of tournament.candidates) {
          for (const session of candidate.sessions) {
            // 推送新消息
            for (const round of session.rounds) {
              for (const msg of round.messages) {
                if (!sentMessageIds.has(msg.id)) {
                  sentMessageIds.add(msg.id);
                  send("candidate_message", {
                    candidateId: candidate.id,
                    displayName: candidate.agent.displayName,
                    sessionId: session.id,
                    scenario: round.scenario,
                    messageId: msg.id,
                    role: msg.role,
                    content: msg.content,
                    seq: msg.seq,
                  });
                }
              }

              // 推送已完成的 round
              if (round.result !== "PENDING" && !sentRoundIds.has(round.id)) {
                sentRoundIds.add(round.id);
                send("candidate_round", {
                  candidateId: candidate.id,
                  displayName: candidate.agent.displayName,
                  sessionId: session.id,
                  roundId: round.id,
                  scenario: round.scenario,
                  score: round.score,
                  scoreReason: round.scoreReason,
                  scoreDetail: round.scoreDetail,
                  result: round.result,
                });
              }
            }
          }
        }

        // 检查是否结束
        if (tournament.status === "COMPLETED" || tournament.status === "FAILED") {
          // 发送最终排名
          const ranked = [...tournament.candidates]
            .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

          send("done", {
            status: tournament.status,
            winnerId: tournament.winnerId,
            rankings: ranked.map((c, i) => ({
              rank: i + 1,
              candidateId: c.id,
              displayName: c.agent.displayName,
              mbti: c.agent.mbti,
              totalScore: c.totalScore,
              status: c.status,
            })),
          });
          finished = true;
          break;
        }

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

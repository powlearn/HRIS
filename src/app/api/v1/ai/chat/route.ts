import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { askCopilot } from "@/modules/ai/service";

const schema = z.object({
  message: z.string().trim().min(2, "Tulis pertanyaan minimal 2 karakter").max(2000),
  conversationId: z.string().optional(),
});

export const POST = apiRoute({
  permission: "ai.use",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    const limit = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!limit.success) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(429, "Terlalu banyak permintaan AI. Tunggu sebentar lalu coba lagi.", { code: "RATE_LIMITED" });
    }

    const result = await askCopilot(user, input.message, input.conversationId);
    return {
      conversationId: result.conversationId,
      reply: result.reply,
      mode: result.mode,
    };
  },
});

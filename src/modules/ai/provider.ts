import { prisma } from "@/lib/prisma";

/**
 * Provider-agnostic adapter for OpenAI-compatible chat completion APIs.
 *
 * The copilot is disabled unless the environment provides both AI_ENABLED=true
 * and a non-empty AI_API_KEY. A tenant administrator can additionally disable it
 * per tenant, but cannot enable it without platform credentials.
 */
export type AiRuntime = {
  available: boolean;
  enabled: boolean;
  configured: boolean;
  model: string;
  baseUrl: string;
  allowConfidential: boolean;
  timeoutMs: number;
  tenantEnabled: boolean;
  reason?: string;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export async function getAiRuntime(tenantId: string): Promise<AiRuntime> {
  const envEnabled = process.env.AI_ENABLED === "true";
  const apiKey = process.env.AI_API_KEY?.trim();
  const configured = Boolean(apiKey);
  const setting = await prisma.systemSetting.findUnique({
    where: { tenantId_key: { tenantId, key: "ai.config" } },
  });
  const tenantConfig = (setting?.value ?? {}) as { enabled?: boolean; allowConfidentialData?: boolean };

  if (!envEnabled) {
    return {
      available: false,
      enabled: false,
      configured,
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      baseUrl: process.env.AI_BASE_URL ?? DEFAULT_BASE_URL,
      allowConfidential: false,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30000),
      tenantEnabled: false,
      reason: "AI dinonaktifkan pada konfigurasi server (AI_ENABLED=false).",
    };
  }
  if (!configured) {
    return {
      available: false,
      enabled: false,
      configured: false,
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      baseUrl: process.env.AI_BASE_URL ?? DEFAULT_BASE_URL,
      allowConfidential: false,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30000),
      tenantEnabled: tenantConfig.enabled !== false,
      reason: "Kredensial penyedia AI belum dikonfigurasi (AI_API_KEY kosong).",
    };
  }
  if (tenantConfig.enabled === false) {
    return {
      available: false,
      enabled: false,
      configured: true,
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      baseUrl: process.env.AI_BASE_URL ?? DEFAULT_BASE_URL,
      allowConfidential: false,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30000),
      tenantEnabled: false,
      reason: "Administrator tenant menonaktifkan AI.",
    };
  }

  return {
    available: true,
    enabled: true,
    configured: true,
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    baseUrl: process.env.AI_BASE_URL ?? DEFAULT_BASE_URL,
    allowConfidential:
      process.env.AI_ALLOW_CONFIDENTIAL_DATA === "true" && Boolean(tenantConfig.allowConfidentialData),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30000),
    tenantEnabled: true,
  };
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatCompletion(messages: ChatMessage[], runtime: AiRuntime): Promise<string> {
  if (!runtime.available) throw new Error(runtime.reason ?? "AI tidak tersedia.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), runtime.timeoutMs);
  try {
    const response = await fetch(`${runtime.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: runtime.model,
        messages,
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Penyedia AI mengembalikan ${response.status}: ${text.slice(0, 200)}`);
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Respons AI kosong.");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

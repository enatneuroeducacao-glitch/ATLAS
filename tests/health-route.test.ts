import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/health/route";

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAIKey;
});

describe("GET /api/health", () => {
  it("reports Gemini configured when GEMINI_API_KEY is present", async () => {
    process.env.GEMINI_API_KEY = "test-key-not-a-real-secret";
    delete process.env.OPENAI_API_KEY;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.aiConfigured).toBe(true);
    expect(body.aiProvider).toBe("gemini");
    expect(JSON.stringify(body)).not.toContain("test-key-not-a-real-secret");
  });

  it("does not report AI configured from OPENAI_API_KEY alone", async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai-key-not-a-real-secret";

    const response = await GET();
    const body = await response.json();

    expect(body.aiConfigured).toBe(false);
    expect(body.aiProvider).toBe("gemini");
  });
});

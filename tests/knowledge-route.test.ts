import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/knowledge/search/route";

const originalEnabled = process.env.ATLAS_LOCAL_KNOWLEDGE_ENABLED;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.ATLAS_LOCAL_KNOWLEDGE_ENABLED;
  else process.env.ATLAS_LOCAL_KNOWLEDGE_ENABLED = originalEnabled;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("POST /api/knowledge/search", () => {
  it("denies access when local knowledge is not explicitly enabled", async () => {
    delete process.env.ATLAS_LOCAL_KNOWLEDGE_ENABLED;
    process.env.NODE_ENV = "test";
    const response = await POST(new Request("http://localhost:3000/api/knowledge/search", {
      method: "POST",
      headers: { host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ query: "percepção de risco" }),
    }));
    expect(response.status).toBe(403);
  });

  it("denies requests with a non-local host", async () => {
    process.env.ATLAS_LOCAL_KNOWLEDGE_ENABLED = "true";
    process.env.NODE_ENV = "test";
    const response = await POST(new Request("http://example.com/api/knowledge/search", {
      method: "POST",
      headers: { host: "example.com", "content-type": "application/json" },
      body: JSON.stringify({ query: "percepção de risco" }),
    }));
    expect(response.status).toBe(403);
  });

  it("rejects a query shorter than the minimum length", async () => {
    process.env.ATLAS_LOCAL_KNOWLEDGE_ENABLED = "true";
    process.env.NODE_ENV = "test";
    const response = await POST(new Request("http://localhost:3000/api/knowledge/search", {
      method: "POST",
      headers: { host: "localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ query: "x" }),
    }));
    expect(response.status).toBe(400);
  });
});

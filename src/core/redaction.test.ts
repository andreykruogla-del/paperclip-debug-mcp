import { describe, expect, it } from "vitest";

import { redactSensitiveText } from "./redaction.js";

describe("redactSensitiveText", () => {
  it("redacts bearer tokens", () => {
    const source = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456";
    const result = redactSensitiveText(source);
    expect(result).toContain("Bearer");
    expect(result).toContain("***REDACTED***");
    expect(result).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });

  it("redacts password-like assignments", () => {
    const source = "password=qwerty123 token=abcdef";
    const result = redactSensitiveText(source);
    expect(result).toContain("password=***REDACTED***");
    expect(result).toContain("token=***REDACTED***");
    expect(result).not.toContain("qwerty123");
  });

  it("keeps non-sensitive text unchanged", () => {
    const source = "service healthy";
    const result = redactSensitiveText(source);
    expect(result).toBe(source);
  });
});

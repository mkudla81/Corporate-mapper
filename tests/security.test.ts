import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { encryptSecret, decryptSecret } from "../src/lib/secrets";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("hunter2hunter2");
    expect(verifyPassword("hunter2hunter2", stored)).toBe(true);
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("produces unique salts", () => {
    expect(hashPassword("same")).not.toEqual(hashPassword("same"));
  });

  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("secret encryption", () => {
  it("round-trips a token", () => {
    const token = "pat-na1-super-secret-token";
    const enc = encryptSecret(token);
    expect(enc).toMatch(/^enc:v1:/);
    expect(enc).not.toContain(token);
    expect(decryptSecret(enc)).toBe(token);
  });

  it("passes through legacy plaintext values", () => {
    expect(decryptSecret("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("uses a fresh IV per encryption", () => {
    expect(encryptSecret("x")).not.toEqual(encryptSecret("x"));
  });
});

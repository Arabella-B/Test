import { describe, expect, it } from "vitest";
import { checkPasscode, createLock, fromB64, isValidPasscode, toB64 } from "./lock";

describe("passcode lock", () => {
  it("accepts the right passcode and rejects wrong ones", async () => {
    const lock = await createLock("4826");
    expect(await checkPasscode(lock, "4826")).toBe(true);
    expect(await checkPasscode(lock, "4827")).toBe(false);
    expect(await checkPasscode(lock, "")).toBe(false);
  });

  it("never stores the passcode itself", async () => {
    const lock = await createLock("135790");
    expect(JSON.stringify(lock)).not.toContain("135790");
  });

  it("gives the same passcode a different fingerprint each time (random salt)", async () => {
    const a = await createLock("1111");
    const b = await createLock("1111");
    expect(a.hash).not.toBe(b.hash);
  });

  it("only allows 4 to 6 digits", () => {
    expect(isValidPasscode("1234")).toBe(true);
    expect(isValidPasscode("123456")).toBe(true);
    expect(isValidPasscode("123")).toBe(false);
    expect(isValidPasscode("12a4")).toBe(false);
  });

  it("round-trips base64", () => {
    const bytes = new Uint8Array([0, 1, 254, 255, 128]);
    expect([...fromB64(toB64(bytes))]).toEqual([...bytes]);
  });
});

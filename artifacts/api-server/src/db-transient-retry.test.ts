import { describe, expect, test } from "vitest";
import { isTransientDbConnectionError, withTransientDbRetry } from "./db-transient-retry";

function pgError(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

describe("isTransientDbConnectionError", () => {
  test("detects SQLSTATE 53300 (connection slots reserved)", () => {
    expect(
      isTransientDbConnectionError(
        pgError("53300", "remaining connection slots are reserved for roles with the SUPERUSER attribute"),
      ),
    ).toBe(true);
  });

  test("detects the drizzle-wrapped cause chain (Failed query -> pg error)", () => {
    const wrapped = new Error(
      'Failed query: select "id" from "abanote"."note_generation_jobs" where ...',
    ) as Error & { cause?: unknown };
    wrapped.cause = pgError("53300", "remaining connection slots are reserved");
    expect(isTransientDbConnectionError(wrapped)).toBe(true);
  });

  test("does not flag ordinary SQL errors", () => {
    expect(isTransientDbConnectionError(pgError("42703", 'column "nope" does not exist'))).toBe(
      false,
    );
    expect(isTransientDbConnectionError(new Error("something else broke"))).toBe(false);
  });
});

describe("withTransientDbRetry", () => {
  test("retries transient failures and returns the eventual result", async () => {
    let calls = 0;
    const result = await withTransientDbRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw pgError("53300", "remaining connection slots are reserved");
        return "ok";
      },
      { attempts: 4, baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  test("rethrows immediately for non-transient errors", async () => {
    let calls = 0;
    await expect(
      withTransientDbRetry(
        async () => {
          calls += 1;
          throw pgError("23505", "duplicate key value violates unique constraint");
        },
        { attempts: 4, baseDelayMs: 1 },
      ),
    ).rejects.toThrow(/duplicate key/);
    expect(calls).toBe(1);
  });

  test("gives up after the configured attempts", async () => {
    let calls = 0;
    await expect(
      withTransientDbRetry(
        async () => {
          calls += 1;
          throw pgError("53300", "remaining connection slots are reserved");
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow(/connection slots/);
    expect(calls).toBe(3);
  });
});

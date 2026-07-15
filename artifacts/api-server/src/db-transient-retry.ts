/**
 * Retry helper for transient Postgres connection failures.
 *
 * The managed Postgres cluster is shared across apps and caps total connections;
 * under momentary pressure it rejects new connections with SQLSTATE 53300
 * ("remaining connection slots are reserved...") or plain socket errors. Those
 * resolve within seconds, so short retries keep note generation and job polling
 * working instead of surfacing a 500 to the RBT.
 */

const TRANSIENT_PG_CODES = new Set([
  "53300", // too_many_connections
  "53400", // configuration_limit_exceeded
  "57P03", // cannot_connect_now (server starting up)
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08006", // connection_failure
]);

const TRANSIENT_MESSAGE_RE =
  /remaining connection slots|too many (?:clients|connections)|connection terminated|timeout exceeded when trying to connect|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i;

export function isTransientDbConnectionError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current != null; depth += 1) {
    if (typeof current === "object") {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && TRANSIENT_PG_CODES.has(code)) return true;
      const message = (current as { message?: unknown }).message;
      if (typeof message === "string" && TRANSIENT_MESSAGE_RE.test(message)) return true;
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `operation`, retrying only on transient connection errors.
 * Non-transient errors (bad SQL, constraint violations, ...) rethrow immediately.
 */
export async function withTransientDbRetry<T>(
  operation: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number; label?: string },
): Promise<T> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!isTransientDbConnectionError(err) || attempt === attempts) {
        throw err;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[db-retry] transient connection error${options?.label ? ` (${options.label})` : ""}; retrying in ${delay}ms (attempt ${attempt}/${attempts})`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

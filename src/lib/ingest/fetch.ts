import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { optionalEnv } from "@/lib/env";

const execFileAsync = promisify(execFile);

export const INGEST_USER_AGENT =
  "AmanaCheck/0.1 (+https://amana-check.vercel.app; ingestion)";
export const ACCEPT_XML =
  "application/rss+xml, application/atom+xml, application/xml, text/xml, */*";
export const ACCEPT_JSON = "application/json, application/*+json, */*";
export const ACCEPT_HTML = "text/html, application/xhtml+xml;q=0.9, */*;q=0.8";

export interface FetchTextOptions {
  accept?: string;
  timeoutMs?: number;
}

/**
 * Some publishers answer non-browser HTTP clients with `202` empty bodies or
 * `406` bot-block pages while allowing curl. We keep the honest AmanaCheck
 * user agent and retry once through curl (fixed argument array, no shell)
 * before treating the source as failed.
 */
function isBotBlock(status: number, body: string): boolean {
  if (status === 202 || status === 406) return true;
  return /blocked due to bot activity/i.test(body);
}

async function fetchWithCurl(
  url: string,
  accept: string,
  timeoutMs: number,
): Promise<string> {
  if (optionalEnv("INGEST_CURL_FALLBACK") === "0") {
    throw new Error("curl fallback is disabled by INGEST_CURL_FALLBACK");
  }
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sSL",
        "--max-time",
        String(Math.ceil(timeoutMs / 1000)),
        "-A",
        INGEST_USER_AGENT,
        "-H",
        `Accept: ${accept}`,
        url,
      ],
      { maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs + 5000 },
    );
    if (!stdout.trim()) {
      throw new Error("curl returned an empty body");
    }
    return stdout;
  } catch (error) {
    throw new Error(
      `curl fallback failed (${error instanceof Error ? error.message : String(error)}). Install curl or set INGEST_CURL_FALLBACK=0 to fail fast.`,
    );
  }
}

export async function fetchText(
  url: string,
  options: FetchTextOptions = {},
): Promise<string> {
  const accept = options.accept ?? ACCEPT_XML;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const attempts = 2;
  let lastError: Error = new Error("fetch failed");

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": INGEST_USER_AGENT, Accept: accept },
      });
      const body = await response.text().catch(() => "");

      if (isBotBlock(response.status, body)) {
        return await fetchWithCurl(url, accept, timeoutMs);
      }
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        if (response.status >= 500 && attempt < attempts) {
          await sleep(500 * attempt);
          continue;
        }
        throw lastError;
      }
      return body;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Some official sites serve an incomplete certificate chain that Bun
      // rejects while curl resolves it. Route TLS failures through the same
      // curl fallback instead of disabling verification.
      if (/certificate|tls|ssl/i.test(message)) {
        try {
          return await fetchWithCurl(url, accept, timeoutMs);
        } catch (curlError) {
          lastError =
            curlError instanceof Error
              ? curlError
              : new Error(String(curlError));
          throw lastError;
        }
      }
      lastError = error instanceof Error ? error : new Error(message);
      if (attempt < attempts) {
        await sleep(500 * attempt);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

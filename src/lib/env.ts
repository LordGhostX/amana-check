export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") return undefined;
  return value;
}

export function parseModelChain(): string[] {
  const raw = optionalEnv("OPENROUTER_MODELS");
  if (!raw) {
    return ["deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4-flash-0731"];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

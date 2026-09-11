import { SITE_URL } from "@/lib/site";

export const UTM_SOURCE = new URL(SITE_URL).host;

export function withUtmSource(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return value;
    url.searchParams.set("utm_source", UTM_SOURCE);
    return url.toString();
  } catch {
    return value;
  }
}

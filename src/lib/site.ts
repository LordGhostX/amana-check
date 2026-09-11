const DEFAULT_SITE_URL = "https://amana-check.vercel.app";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (configuredSiteUrl || DEFAULT_SITE_URL).replace(
  /\/+$/,
  "",
);

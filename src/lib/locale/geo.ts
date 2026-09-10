export interface GeoHint {
  country?: string;
  regionCode?: string;
  city?: string;
  timezone?: string;
}

/**
 * Vercel populates these headers in deployments; they are absent locally.
 * Geo is only ever used to SUGGEST the corpus pack and as the weakest
 * location precedence rung. It is never used to guess language and is
 * never persisted with request content.
 */
export function geoFromHeaders(headers: Headers): GeoHint {
  const country = headers.get("x-vercel-ip-country") ?? undefined;
  const region = headers.get("x-vercel-ip-country-region") ?? undefined;
  return {
    country,
    regionCode:
      country && region ? `${country.toUpperCase()}-${region.toUpperCase()}` : undefined,
    city: headers.get("x-vercel-ip-city") ?? undefined,
    timezone: headers.get("x-vercel-ip-timezone") ?? undefined,
  };
}

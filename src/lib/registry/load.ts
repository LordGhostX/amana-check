import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  regionFileSchema,
  sourceFileSchema,
  type RegionFile,
  type SourceFile,
} from "./schema";

export type CountrySlug = "nigeria" | "kenya";

const DATA_DIR = join(process.cwd(), "data");

export function loadRegionFile(slug: CountrySlug): RegionFile {
  const raw = readFileSync(join(DATA_DIR, "regions", `${slug}.json`), "utf8");
  return regionFileSchema.parse(JSON.parse(raw));
}

export function loadSourceFile(slug: CountrySlug): SourceFile {
  const raw = readFileSync(join(DATA_DIR, "sources", `${slug}.yml`), "utf8");
  return sourceFileSchema.parse(parseYaml(raw));
}

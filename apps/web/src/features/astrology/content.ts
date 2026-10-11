import type {
  NatalVersions,
  InterpretationPlan,
} from "@pxoracle/contracts/natal";
export const NATAL_VERSIONS: NatalVersions = {
  schema: 1,
  calculation: "0.1.0",
  interpretation: "natal.1",
  semantics: "natal-semantics.1",
  rules: "natal-rules.1",
  content: "natal.en.1",
};
export interface NatalArticle {
  summary: string;
  body: string;
  constructive: string;
  tension: string;
  question: string;
}
export interface NatalContent {
  versions: NatalVersions;
  locale: "en";
  articles: Record<string, NatalArticle>;
  glossary: Record<string, string>;
}
export function currentVersions(value: unknown): value is NatalVersions {
  return (
    !!value &&
    typeof value === "object" &&
    Object.keys(value).length === 6 &&
    Object.entries(NATAL_VERSIONS).every(
      ([key, version]) => (value as Record<string, unknown>)[key] === version,
    )
  );
}
let cached: NatalContent | undefined;
async function bytes(url: string, limit: number, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok || Number(response.headers.get("content-length")) > limit)
    throw new Error("NATAL_CONTENT_FAILED");
  const data = await response.arrayBuffer();
  if (data.byteLength > limit) throw new Error("NATAL_CONTENT_FAILED");
  return data;
}
export async function loadNatalContent(
  signal: AbortSignal,
): Promise<NatalContent> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (cached) return cached;
  const manifest = JSON.parse(
    new TextDecoder().decode(
      await bytes("/content/natal/manifest.1.json", 10000, signal),
    ),
  );
  const file = manifest.files?.en;
  if (
    !currentVersions(manifest.versions) ||
    file?.path !== "en.1.json" ||
    !Number.isInteger(file.bytes) ||
    file.bytes < 1 ||
    file.bytes > 750000 ||
    !/^[a-f0-9]{64}$/.test(file.sha256)
  )
    throw new Error("NATAL_CONTENT_FAILED");
  const data = await bytes(`/content/natal/${file.path}`, 750000, signal);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  if (data.byteLength !== file.bytes || hash !== file.sha256)
    throw new Error("NATAL_CONTENT_FAILED");
  const content = JSON.parse(new TextDecoder().decode(data)) as NatalContent;
  if (
    !currentVersions(content.versions) ||
    content.locale !== "en" ||
    !content.articles ||
    Object.keys(content.articles).length > 1200 ||
    !content.glossary ||
    Object.keys(content.glossary).length > 100
  )
    throw new Error("NATAL_CONTENT_FAILED");
  for (const article of Object.values(content.articles)) {
    if (
      !article ||
      Object.keys(article).length !== 5 ||
      ![
        article.summary,
        article.body,
        article.constructive,
        article.tension,
        article.question,
      ].every((x) => typeof x === "string" && x.length > 0 && x.length < 8000)
    )
      throw new Error("NATAL_CONTENT_FAILED");
  }
  if (
    !Object.values(content.glossary).every(
      (x) => typeof x === "string" && x.length < 4000,
    )
  )
    throw new Error("NATAL_CONTENT_FAILED");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  cached = content;
  return content;
}
export function validatePlanReferences(
  plan: InterpretationPlan,
  content: NatalContent,
) {
  if (!currentVersions(plan.versions)) throw new Error("NATAL_VERSION");
  const all = [...plan.placements, ...plan.aspects, ...plan.themes];
  const refs = [
    ...plan.overviewRefs,
    ...all.map((x) => x.reference),
    ...plan.topics.map((x) => x.reference),
  ];
  if (refs.some((id) => !Object.hasOwn(content.articles, id)))
    throw new Error("NATAL_CONTENT_FAILED");
  const ids = new Set([...plan.placements, ...plan.aspects].map((x) => x.id));
  if (
    [
      ...plan.coreIds,
      ...plan.importantAspectIds,
      ...plan.topics.flatMap((x) => x.itemIds),
    ].some((id) => !ids.has(id))
  )
    throw new Error("NATAL_CONTENT_FAILED");
}

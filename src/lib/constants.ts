export const WEB_SEARCH_PROMPT =
  "Search for factual, verifiable information from multiple reputable sources, avoiding opinion, advocacy, or activist framing. Include diverse perspectives where relevant, and prioritize original reporting, primary data, and official statements.";

export const DEFAULT_WEB_PLUGIN = {
  id: "web",
  max_results: 1,
  search_prompt: WEB_SEARCH_PROMPT,
} as const;

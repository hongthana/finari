export function getSecUserAgent(): string {
  return (
    process.env.SEC_USER_AGENT?.trim() ||
    "Finari/0.1 (development research app; contact=dev@finari.local)"
  );
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
}

export function getDatabasePath(): string {
  return process.env.FINARI_DB_PATH?.trim() || ".data/finari.sqlite";
}

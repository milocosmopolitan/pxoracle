"use client";
export function ErrorNotice({
  code,
  retry,
}: {
  code: string;
  retry?: () => void;
}) {
  const messages: Record<string, string> = {
    AMBIGUOUS_LOCAL_TIME:
      "This time occurs twice. Choose the earlier or later occurrence below.",
    NONEXISTENT_LOCAL_TIME:
      "This local time did not exist because the clocks changed. Please correct the time.",
    INVALID_TIMEZONE: "Enter a valid IANA time zone, such as America/New_York.",
    UNSUPPORTED_DATE:
      "This version supports birth dates from 1900 through 2100.",
    ENGINE_LOAD_FAILED:
      "The calculation engine could not load. Check your connection and retry.",
    ENGINE_TIMEOUT: "The calculation took too long. Please retry.",
    INCOMPATIBLE_SESSION: "This saved reading uses an unsupported version.",
    INVALID_SESSION: "This saved reading is damaged or incomplete.",
  };
  return (
    <div className="error" role="alert">
      <p>
        {messages[code] ??
          "The request could not be completed. Check your input and try again."}
      </p>
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
export function Loading() {
  return (
    <p className="loading" role="status">
      <span>✧</span> Preparing your reading…
    </p>
  );
}
export function saveReading(feature: string, value: unknown) {
  localStorage.setItem(
    `pxoracle.${feature}.v1`,
    JSON.stringify({ schemaVersion: 1, value }),
  );
}
export function readReading(feature: string): unknown {
  const text = localStorage.getItem(`pxoracle.${feature}.v1`);
  if (!text) return null;
  const parsed = JSON.parse(text);
  if (parsed.schemaVersion !== 1) throw new Error("INCOMPATIBLE_SESSION");
  return parsed.value;
}

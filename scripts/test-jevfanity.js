const API_URL = "https://api.jevfanity.com/v1/moderate";
const LEVELS = new Set(["low", "medium", "strict"]);

async function main() {
  const [text = "This is a simple moderation test.", level = "medium"] =
    process.argv.slice(2);

  if (!LEVELS.has(level)) {
    throw new Error("Level must be one of: low, medium, strict.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, level }),
  });

  const rawBody = await response.text();
  let result;

  try {
    result = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `API returned non-JSON content (${response.status}): ${rawBody}`,
    );
  }

  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After");
    const retryMessage = retryAfter ? ` Retry after ${retryAfter}s.` : "";
    throw new Error(
      `API request failed (${response.status}).${retryMessage}\n${JSON.stringify(result, null, 2)}`,
    );
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

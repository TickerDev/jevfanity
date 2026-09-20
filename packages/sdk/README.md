# jevfanity

Typed JavaScript and TypeScript client for the [Jevfanity](https://jevfanity.app) moderation API.

The SDK works in Node.js 18+, modern browsers, and other runtimes with a global `fetch`. It provides moderation scores for profanity, slurs, harassment, threats, and sexual content.

## Install

```bash
npm install jevfanity
```

## Usage

```js
import Jevfanity from "jevfanity";

const client = new Jevfanity();
const result = await client.moderate("Text to check", {
  level: "medium",
  threshold: 0.75,
  categories: ["profanity", "harassment"],
});

if (result.flagged) {
  console.log(result.flagged_categories);
}
```

The default API URL is `https://api.jevfanity.app`. For a self-hosted API or a protected deployment:

```js
const client = new Jevfanity({
  baseUrl: "https://moderation.example.com",
  apiKey: process.env.JEVFANITY_API_KEY,
});
```

## API

### `client.moderate(text, options?)`

Returns a typed `ModerationResult` containing:

- `flagged`: whether any selected category reached the threshold
- `score`: the highest category score
- `categories`: a score from `0` to `1` for each selected category
- `flagged_categories`: categories that reached the threshold
- `level` and `threshold`: the policy used for the request
- `usage` and `processing`: model and request details

Supported levels are `low`, `medium`, and `strict`. Supported categories are `profanity`, `slur`, `harassment`, `threat`, and `sexual`.

### `client.health()`

Checks whether the API is available and returns `{ ok: true, service: "jevfanity" }`.

## Errors

HTTP failures and network failures throw `JevfanityError`:

```js
import Jevfanity, { JevfanityError } from "jevfanity";

try {
  await new Jevfanity().moderate(message);
} catch (error) {
  if (error instanceof JevfanityError) {
    console.error(error.status, error.body);
  }
}
```

`status` contains the HTTP status code, or `0` for a transport failure. `body` contains the parsed API error when one is available.

## Custom fetch

Pass a custom `fetch` implementation through the constructor when testing or integrating with a runtime that provides its own HTTP client:

```js
const client = new Jevfanity({
  fetch: (url, init) => fetch(url, init),
});
```

## Development

This package is part of the Jevfanity workspace monorepo. From the repository root:

```bash
npm run build
npm run typecheck --workspace jevfanity
npm pack --dry-run --workspace jevfanity
```

Only this `jevfanity` workspace is published to npm. The API and web workspaces are private.
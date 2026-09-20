# Contributing to Jevfanity

Thanks for helping improve Jevfanity.

## Development setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.dev.vars` and add your own TypeSafe API key:

   ```env
   TYPESAFE_API_KEY=your_key_here
   ```

4. Start the local Worker:

   ```bash
   npm run dev
   ```

Never commit `.dev.vars`, API keys, access tokens, or production data.

## Making changes

- Keep changes focused and consistent with the existing TypeScript style.
- Preserve the public API unless the change intentionally updates its contract.
- Document new request fields, response fields, limits, and environment variables.
- Keep moderation policy changes explicit for all three levels: `low`, `medium`, and `strict`.
- Avoid adding examples that target or demean real people or protected groups.

## Validation

Run the typecheck before opening a pull request:

```bash
npm run typecheck
```

For API changes, test locally with representative allowed and flagged inputs. Do not run load tests against the free hosted instance.

## Pull requests

Include:

- A concise description of the problem and solution.
- Any API or behavior changes.
- The validation you performed.
- Documentation updates when user-facing behavior changes.

Keep unrelated refactors in separate pull requests so changes remain easy to review.

## Security issues

Do not open a public issue containing credentials, private user content, or an exploitable vulnerability. Contact the maintainer privately with enough detail to reproduce and assess the issue.

By contributing, you agree that your contribution is licensed under the MIT License.

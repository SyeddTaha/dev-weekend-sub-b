# URL Risk Checker Answers

## 1. How to run

1. Install Node.js 18 or newer.
2. Set `URLHAUS_AUTH_KEY` in your shell or in a local `.env` file at the project root. The app loads `.env` automatically on startup.
3. From the project root, run:

```powershell
npm start
```

4. Open http://localhost:3000 in your browser.

There are no third-party dependencies in this submission, so there is no separate install step beyond having Node.js available.

## 2. Stack choice

I picked plain Node.js 18+ with built-in `http`, `fetch`, because this task is small, security-sensitive, and does not need a framework to work well. It keeps setup simple on a fresh machine, avoids extra packages, and makes the trust boundary obvious: the browser talks only to my local server, and the server talks to URLhaus.

A worse choice would have been a browser-only implementation that calls URLhaus directly, because that would expose the auth key and weaken server-side validation. A heavier framework would also be worse here because it would add setup and abstraction without improving the actual behavior being tested.

## 3. One real edge case

The server rejects URLs with embedded credentials in [src/validation.js](src/validation.js#L32). For example, `https://user:pass@example.com/path` is stopped before it reaches URLhaus. Without that check, the app could forward a credential-bearing URL, which is both risky and unnecessary, and the input would be less strictly controlled than the rest of the validation rules.

## 4. AI usage

I took idea from perlexity.ai and for building,
I used Copilot during the build in these places:

1. `fetch_webpage` on the URLhaus API docs. I asked what the `/v1/url/` endpoint expects and what shapes it returns. It showed that URLhaus requires an `Auth-Key` header and can return both a single URL object and other response shapes.
2. `apply_patch` on the source files. I asked it to create the server, validation, URLhaus client, result mapping, frontend, tests, and docs, and it applied the code edits I asked for.
3. `run_in_terminal` for verification. I asked it to run `npm test`, start the server, and POST sample URLs to the API. It returned passing tests and live JSON results from the app.
4. Browser automation tools such as `run_playwright_code` and the browser page tools. I asked them to load the UI, submit test URLs, and confirm the page rendered the correct verdicts and details.

One change I made to AI output was the `no_results` wording and server debugging. The earlier phrasing was longer and included a caution that the result is not a guarantee. I changed it to `Secure and safe.` because you explicitly asked for that wording and it fits the UI better.


## 5. Honest gap

The app still uses a simple in-memory cache, so cached results disappear when the server restarts and do not share across multiple instances. That is fine for a small submission, but it is not strong enough for a production deployment.
With another day, I would replace that with a small persistent cache or add a clearer cache strategy, then write one or two tests around cache expiry and restart behavior.
Also that it does not include a full end-to-end test for the real browser-to-server-to-URLhaus flow. The unit tests cover the validator and URLhaus client, but they do not prove the complete HTTP path in one shot. I would add an integration test that starts the server against a mocked URLhaus endpoint and checks the rendered response path end to end.
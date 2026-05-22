# URL Risk Checker

URL Risk Checker is a small Node.js web app that checks whether a pasted URL appears in the URLhaus malware URL database.

## What it does

- Validates user input on the server
- Sends only the normalized URL to the trusted URLhaus API endpoint
- Shows a simple verdict: Safe, Suspicious, Malicious, or Unknown
- Displays matched URLhaus data when available
- Uses a small in-memory cache and local recent lookup history

## Important note

URLhaus API access requires a free auth key from abuse.ch. Do not commit that key to this repository.

If you keep the key in a local `.env` file, the app will load it automatically. You can also set it in your shell before starting the app:

```powershell
$env:URLHAUS_AUTH_KEY = 'your-key-here'
npm start
```

## Requirements

- Node.js 18 or newer

## Run

```powershell
npm start
```

Then open frontend on:

```text
http://localhost:3000
```

## Test URLs

These URLs returned a suspicious verdict during local testing. URLhaus data changes over time, so the current verdict may shift later.

| URL | Observed verdict | URLhaus reference |
| --- | --- | --- |
| http://45.61.49.78/razor/r4z0r.mips | Suspicious | https://urlhaus.abuse.ch/url/223622/ |
| http://vektorex.com/source/Z/5016223.exe | Suspicious | https://urlhaus.abuse.ch/url/121319/ |
| http://185.189.149.164/adobe_update.exe | Suspicious | https://urlhaus.abuse.ch/url/100211/ |

## Security choices

- Only http and https URLs are accepted
- The server never fetches the submitted URL itself
- Requests to URLhaus use a timeout and a small retry budget
- Secrets stay in local environment variables
- Responses are escaped in the browser before rendering

## Files

- `src/server.js`: HTTP server and API proxy
- `src/validation.js`: URL normalization and validation
- `src/urlhaus-client.js`: URLhaus lookup and response mapping
- `src/result-transform.js`: UI-ready result formatting
- `public/`: frontend files
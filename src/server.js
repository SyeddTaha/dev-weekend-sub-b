import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	lookupUrlInUrlhaus,
	UrlhausConfigurationError,
	UrlhausLookupError,
} from "./urlhaus-client.js";
import { validateAndNormalizeUrl } from "./validation.js";
import { toDisplayResult } from "./result-transform.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const projectRoot = resolve(__dirname, "..");
const publicDir = join(projectRoot, "public");
loadEnvironmentFile(join(projectRoot, ".env"));
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;
const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(async (request, response) => {
	setSecurityHeaders(response);

	try {
		if (request.method === "GET" && request.url === "/") {
			await serveFile(
				response,
				join(publicDir, "index.html"),
				"text/html; charset=utf-8",
			);
			return;
		}

		if (request.method === "GET" && request.url === "/styles.css") {
			await serveFile(
				response,
				join(publicDir, "styles.css"),
				"text/css; charset=utf-8",
			);
			return;
		}

		if (request.method === "GET" && request.url === "/app.js") {
			await serveFile(
				response,
				join(publicDir, "app.js"),
				"application/javascript; charset=utf-8",
			);
			return;
		}

		if (request.method === "POST" && request.url === "/api/check-url") {
			const body = await readJsonBody(request);
			const validation = validateAndNormalizeUrl(body?.url);

			if (!validation.ok) {
				sendJson(response, 400, { ok: false, error: validation.error });
				return;
			}

			const cached = getCachedResult(validation.url);
			if (cached) {
				sendJson(response, 200, {
					ok: true,
					cached: true,
					result: cached,
				});
				return;
			}

			if (!process.env.URLHAUS_AUTH_KEY) {
				sendJson(response, 503, {
					ok: false,
					error: "URLhaus access is not configured on this machine yet.",
					hint: "Set URLHAUS_AUTH_KEY in your local environment before starting the app.",
				});
				return;
			}

			const lookupResult = await lookupUrlInUrlhaus(validation.url, {
				authKey: process.env.URLHAUS_AUTH_KEY,
				timeoutMs: 8000,
				retryCount: 1,
			});
			const displayResult = toDisplayResult(lookupResult);
			setCachedResult(validation.url, displayResult);
			sendJson(response, 200, {
				ok: true,
				cached: false,
				result: displayResult,
			});
			return;
		}

		sendJson(response, 404, { ok: false, error: "Not found." });
	} catch (error) {
		if (error instanceof UrlhausConfigurationError) {
			sendJson(response, 503, {
				ok: false,
				error: error.message,
				hint: "Set URLHAUS_AUTH_KEY in your local environment before starting the app.",
			});
			return;
		}

		if (error instanceof UrlhausLookupError) {
			sendJson(response, 502, { ok: false, error: error.message });
			return;
		}

		sendJson(response, 500, {
			ok: false,
			error: "Unexpected server error.",
		});
	}
});

server.listen(PORT, () => {
	console.log(`URL Risk Checker running at http://localhost:${PORT}`);
});

async function serveFile(response, filePath, contentType) {
	const body = await readFile(filePath);
	response.writeHead(200, { "Content-Type": contentType });
	response.end(body);
}

function setSecurityHeaders(response) {
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("X-Frame-Options", "DENY");
	response.setHeader("Referrer-Policy", "no-referrer");
	response.setHeader(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=()",
	);
	response.setHeader(
		"Content-Security-Policy",
		"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
	);
}

async function readJsonBody(request) {
	const chunks = [];
	let totalLength = 0;

	for await (const chunk of request) {
		totalLength += chunk.length;
		if (totalLength > 16 * 1024) {
			throw new UrlhausLookupError("Request body is too large.", {
				code: "body_too_large",
			});
		}
		chunks.push(chunk);
	}

	if (chunks.length === 0) {
		return {};
	}

	const rawBody = Buffer.concat(chunks).toString("utf8");
	try {
		return JSON.parse(rawBody);
	} catch {
		throw new UrlhausLookupError("Request body must be valid JSON.", {
			code: "invalid_json",
		});
	}
}

function sendJson(response, statusCode, payload) {
	response.writeHead(statusCode, {
		"Content-Type": "application/json; charset=utf-8",
	});
	response.end(JSON.stringify(payload));
}

function getCachedResult(url) {
	const cached = cache.get(url);
	if (!cached) {
		return null;
	}

	if (Date.now() > cached.expiresAt) {
		cache.delete(url);
		return null;
	}

	return cached.value;
}

function setCachedResult(url, value) {
	cache.set(url, {
		value,
		expiresAt: Date.now() + CACHE_TTL_MS,
	});
}

function loadEnvironmentFile(filePath) {
	try {
		const fileContents = readFileSync(filePath, "utf8");
		for (const line of fileContents.split(/\r?\n/)) {
			const trimmedLine = line.trim();
			if (!trimmedLine || trimmedLine.startsWith("#")) {
				continue;
			}

			const equalsIndex = trimmedLine.indexOf("=");
			if (equalsIndex <= 0) {
				continue;
			}

			const key = trimmedLine.slice(0, equalsIndex).trim();
			if (!key || process.env[key]) {
				continue;
			}

			let value = trimmedLine.slice(equalsIndex + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			process.env[key] = value;
		}
	} catch {
		// No local .env file is fine; the README explains how to set variables manually.
	}
}

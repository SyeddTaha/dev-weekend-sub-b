const URLHAUS_LOOKUP_ENDPOINT = "https://urlhaus-api.abuse.ch/v1/url/";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_COUNT = 1;

export class UrlhausConfigurationError extends Error {
	constructor(message) {
		super(message);
		this.name = "UrlhausConfigurationError";
	}
}

export class UrlhausLookupError extends Error {
	constructor(message, options = {}) {
		super(message);
		this.name = "UrlhausLookupError";
		this.code = options.code || "lookup_failed";
		this.status = options.status;
	}
}

export async function lookupUrlInUrlhaus(url, options = {}) {
	const authKey = options.authKey || process.env.URLHAUS_AUTH_KEY;
	if (!authKey) {
		throw new UrlhausConfigurationError(
			"URLhaus auth key is missing. Set URLHAUS_AUTH_KEY in your environment.",
		);
	}

	const fetchImpl = options.fetchImpl || fetch;
	const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
	const retryCount = Number.isInteger(options.retryCount)
		? options.retryCount
		: DEFAULT_RETRY_COUNT;

	let lastError;
	for (let attempt = 0; attempt <= retryCount; attempt += 1) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetchImpl(URLHAUS_LOOKUP_ENDPOINT, {
				method: "POST",
				headers: {
					"Auth-Key": authKey,
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
				},
				body: new URLSearchParams({ url }).toString(),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new UrlhausLookupError(
					`URLhaus returned HTTP ${response.status}.`,
					{
						code: "http_error",
						status: response.status,
					},
				);
			}

			const data = await response.json();
			return normalizeUrlhausResponse(data, url);
		} catch (error) {
			clearTimeout(timeoutId);
			lastError = error;

			if (!shouldRetry(error) || attempt === retryCount) {
				break;
			}
		}
	}

	if (
		lastError instanceof UrlhausLookupError ||
		lastError instanceof UrlhausConfigurationError
	) {
		throw lastError;
	}

	throw new UrlhausLookupError(
		"URLhaus lookup failed. Please try again later.",
		{
			code:
				lastError?.name === "AbortError" ? "timeout" : "network_error",
		},
	);
}

function shouldRetry(error) {
	return (
		error?.name === "AbortError" ||
		error instanceof TypeError ||
		error instanceof UrlhausLookupError
	);
}

function normalizeUrlhausResponse(data, queriedUrl) {
	const queryStatus = data?.query_status;

	if (queryStatus === "ok") {
		const entry = extractUrlEntry(data);
		return {
			verdict: classifyMatchedEntry(entry),
			explanation: buildMatchedExplanation(entry),
			queryStatus,
			matched: entry,
			reference: entry?.urlhaus_reference || null,
			queriedUrl,
		};
	}

	if (queryStatus === "no_results") {
		return {
			verdict: "safe",
			explanation:
				"URLhaus does not currently have a match for this URL. That is not a guarantee that the URL is safe.",
			queryStatus,
			matched: null,
			reference: null,
			queriedUrl,
		};
	}

	if (queryStatus === "invalid_url") {
		return {
			verdict: "unknown",
			explanation: "URLhaus rejected the URL as invalid.",
			queryStatus,
			matched: null,
			reference: null,
			queriedUrl,
		};
	}

	throw new UrlhausLookupError("URLhaus returned an unexpected response.", {
		code: "unexpected_response",
	});
}

function extractUrlEntry(data) {
	if (data && typeof data === "object") {
		if (typeof data.id !== "undefined" || typeof data.url !== "undefined") {
			return data;
		}

		if (Array.isArray(data.urls) && data.urls.length > 0) {
			return data.urls[0];
		}
	}

	return null;
}

function classifyMatchedEntry(entry) {
	if (!entry) {
		return "unknown";
	}

	if (entry.url_status === "online") {
		return "malicious";
	}

	if (entry.url_status === "offline") {
		return "suspicious";
	}

	return "unknown";
}

function buildMatchedExplanation(entry) {
	if (!entry) {
		return "URLhaus returned a match, but the result could not be read clearly.";
	}

	if (entry.url_status === "online") {
		return "URLhaus currently lists this URL as active malware delivery.";
	}

	if (entry.url_status === "offline") {
		return "URLhaus has seen this URL before, but it is currently offline.";
	}

	return "URLhaus has seen this URL before, but the current status is unclear.";
}

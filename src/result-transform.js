export function toDisplayResult(urlhausResult) {
	if (!urlhausResult) {
		return null;
	}

	const matched = urlhausResult.matched;
	return {
		verdict: formatVerdict(urlhausResult.verdict),
		verdictKey: urlhausResult.verdict,
		explanation: urlhausResult.explanation,
		reference: urlhausResult.reference,
		matchedData: matched
			? {
					id: matched.id ?? null,
					url: matched.url ?? null,
					urlStatus: matched.url_status ?? null,
					dateAdded: matched.date_added ?? null,
					lastOnline: matched.last_online ?? null,
					threat: matched.threat ?? null,
					reporter: matched.reporter ?? null,
					larted: matched.larted ?? null,
					tags: Array.isArray(matched.tags) ? matched.tags : [],
					payloads: Array.isArray(matched.payloads)
						? matched.payloads.slice(0, 3).map((payload) => ({
								filename: payload.filename ?? null,
								firstseen: payload.firstseen ?? null,
								lastseen: payload.lastseen ?? null,
								url: payload.url ?? null,
								urlStatus: payload.url_status ?? null,
								reference: payload.urlhaus_reference ?? null,
							}))
						: [],
				}
			: null,
	};
}

function formatVerdict(verdict) {
	switch (verdict) {
		case "safe":
			return "Safe";
		case "suspicious":
			return "Suspicious";
		case "malicious":
			return "Malicious";
		default:
			return "Unknown";
	}
}

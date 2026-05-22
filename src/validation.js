const MAX_URL_LENGTH = 2048;

export function validateAndNormalizeUrl(input){
	if (typeof input !== "string"){
		return { ok: false, error: "Please enter a URL." };
	}

	const trimmed = input.trim();
	if (!trimmed){
		return { ok: false, error: "Please enter a URL." };
	}

	if (trimmed.length > MAX_URL_LENGTH){
		return { ok: false, error: "The URL is too long." };
	}

	let parsedUrl;
	try{
		parsedUrl = new URL(trimmed);
	} catch{
		return { ok: false, error: "That does not look like a valid URL." };
	}

	if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:"){
		return { ok: false, error: "Only http and https URLs are allowed." };
	}

	if (!parsedUrl.hostname){
		return { ok: false, error: "The URL must include a host name." };
	}

	if (parsedUrl.username || parsedUrl.password){
		return {
			ok: false,
			error: "URLs with embedded credentials are not allowed.",
		};
	}

	parsedUrl.hash = "";
	return { ok: true, url: parsedUrl.toString() };
}

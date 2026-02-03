/// <reference types="vite/client" />
/// <reference types="vite-plugin-fastly/types" />

import { command } from "vite-plugin-fastly:environment";

export default function handler(event: FetchEvent) {
	return new Response(HTML, {
		headers: { "Content-Type": "text/html" },
	});
}

if (command !== "serve") {
	addEventListener("fetch", (event) => {
		event.respondWith(handler(event));
	});
}

const HTML = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Fastly Compute JS Server-Only Example</title>
	</head>
	<body>
		<h1>vite-plugin-fastly</h1>
		<p>This is a server-only example running on Fastly Compute JS.</p>
	</body>
</html>
`;

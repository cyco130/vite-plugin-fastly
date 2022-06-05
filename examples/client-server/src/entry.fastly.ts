/// <reference types="vite/client" />
/// <reference types="vite-plugin-fastly/types" />

import { command } from "vite-plugin-fastly:environment";
import clientManifest from "vite-client-manifest";
import { PublisherServer } from "@fastly/compute-js-static-publish";

import rc from "../static-publish.rc.js";

const publisherServer = PublisherServer.fromStaticPublishRc(rc);

export default async function handler(event: FetchEvent) {
	// Serve static assets in build mode.
	// In serve mode, Vite dev server handles static assets by transforming and serving them on the fly.
	if (command === "build") {
		const staticResponse = await publisherServer.serveRequest(event.request);
		if (staticResponse != null) {
			return staticResponse;
		}
	}

	const url = new URL(event.request.url);
	if (url.pathname === "/") {
		return new Response(getHtml(), {
			headers: { "Content-Type": "text/html" },
		});
	}

	return new Response("Not Found", { status: 404 });
}

let injectToHead: string;

if (command === "build") {
	injectToHead = "";

	// Add fetch event listener for Fastly Compute in build mode.
	addEventListener("fetch", (event) => {
		event.respondWith(handler(event));
	});
} else {
	injectToHead = `<script type="module" src="/@vite/client"></script>`;
}

function getHtml() {
	let entry = "src/entry.client.ts";

	// Translate entry to built file in build mode.
	if (clientManifest[entry]) {
		entry = clientManifest[entry].file;
	}

	const escapedEntry = JSON.stringify("/" + entry);

	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Fastly and Vite Client-Server Example</title>
		${injectToHead}
	</head>
	<body>
		<h1>Hello from Fastly and Vite Client-Server Example</h1>
		<button id="count-button">Count: 0</button>
		<script type="module" src=${escapedEntry}></script>
	</body>
</html>
`;
}

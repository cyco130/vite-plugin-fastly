/// <reference types="vite/client" />
/// <reference types="vite-plugin-fastly/types" />

import { command } from "vite-plugin-fastly:environment";

export default function handler(event: FetchEvent) {
	return new Response("Hello from Fastly and Vite!");
}

if (command !== "serve") {
	addEventListener("fetch", (event) => {
		event.respondWith(handler(event));
	});
}

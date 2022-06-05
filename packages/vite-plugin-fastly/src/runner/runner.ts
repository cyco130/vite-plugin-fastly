import { ESModulesEvaluator, ModuleRunner } from "vite/module-runner";

const evaluator = new ESModulesEvaluator();

evaluator.runExternalModule = async (filepath) => {
	switch (filepath) {
		case "fastly:acl":
			return await import("fastly:acl");
		case "fastly:backend":
			return await import("fastly:backend");
		case "fastly:cache":
			return await import("fastly:cache");
		case "fastly:cache-override":
			return await import("fastly:cache-override");
		case "fastly:compute":
			return await import("fastly:compute");
		case "fastly:config-store":
			return await import("fastly:config-store");
		case "fastly:device":
			return await import("fastly:device");
		case "fastly:dictionary":
			return await import("fastly:dictionary");
		case "fastly:edge-rate-limiter":
			return await import("fastly:edge-rate-limiter");
		case "fastly:env":
			return await import("fastly:env");
		case "fastly:experimental":
			return await import("fastly:experimental");
		case "fastly:fanout":
			return await import("fastly:fanout");
		case "fastly:geolocation":
			return await import("fastly:geolocation");
		case "fastly:html-rewriter":
			return await import("fastly:html-rewriter");
		case "fastly:image-optimizer":
			return await import("fastly:image-optimizer");
		case "fastly:kv-store":
			return await import("fastly:kv-store");
		case "fastly:logger":
			return await import("fastly:logger");
		case "fastly:secret-store":
			return await import("fastly:secret-store");
		case "fastly:websocket":
			return await import("fastly:websocket");

		default:
			throw new Error("Unknown external module: " + filepath);
	}
};

const runner = new ModuleRunner(
	{
		hmr: false,

		transport: {
			async invoke(data: any) {
				return fetch(`${viteServerAddress}/@vite-plugin-fastly/transport`, {
					method: "POST",
					body: JSON.stringify(data),
				}).then((r) => {
					if (!r.ok) {
						return { error: new Error(`Transport error ${r.status}`) };
					}

					return r.json() as Promise<any>;
				});
			},
		},
	},
	evaluator,
);

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

let viteServerAddress: string;

async function handleRequest(event: FetchEvent) {
	const request = event.request;

	if (request.method === "GET") {
		const url = new URL(request.url);
		const path = url.pathname;
		if (path === "/@vite-plugin-fastly/ready") {
			return new Response("OK", { status: 200 });
		}
	}

	viteServerAddress ||= request.headers.get(
		"Vite-Plugin-Fastly-Vite-Server-Address",
	)!;

	const handlerEntry = request.headers.get("Vite-Plugin-Fastly-Handler-Entry")!;

	if (!viteServerAddress) {
		return new Response("Vite server address header is missing", {
			status: 500,
		});
	}

	if (!handlerEntry) {
		return new Response("Handler entry header is missing", {
			status: 500,
		});
	}

	const module = await runner.import(handlerEntry);
	return await module.default(event);
}

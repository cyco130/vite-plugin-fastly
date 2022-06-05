import type { Plugin, UserConfig } from "vite";
import { fastly } from "vite-plugin-fastly";
import { rm } from "fs/promises";

export default {
	// This setting prevents Vite from serving index.html automatically.
	appType: "custom",
	// Configure both client and SSR environments.
	environments: {
		client: {
			build: {
				// Enable manifest generation for client build.
				manifest: true,
				outDir: "dist/client",
				rollupOptions: {
					input: "src/entry.client.ts",
				},
			},
		},
		ssr: {
			build: {
				outDir: "dist/ssr",
				rollupOptions: {
					input: "src/entry.fastly.ts",
				},
			},
		},
	},
	// Build both environments, client first.
	builder: {
		async buildApp(builder) {
			await rm("dist", { recursive: true, force: true });
			await builder.build(builder.environments.client);
			await builder.build(builder.environments.ssr);
		},
	},
	plugins: [fastly(), resolveClientManifest()],
} satisfies UserConfig;

// This mini plugin resolves the client manifest file path
// while building the SSR environment so that the server code
// can reference the correct built client assets by importing
// "vite-client-manifest". During development, it resolves to
// a virtual module that exports an empty object.
function resolveClientManifest(): Plugin {
	let command: "build" | "serve";
	let root: string;

	return {
		name: "resolve-client-manifest",

		applyToEnvironment(environment) {
			if (environment.name !== "ssr") {
				return false;
			}

			command = environment.config.command;
			root = environment.config.root;
			return true;
		},

		resolveId: {
			filter: {
				id: /^vite-client-manifest$/,
			},
			async handler(source, importer, options) {
				if (source !== "vite-client-manifest") {
					return;
				}

				if (command === "serve") {
					return "\0virtual:vite-client-manifest";
				}

				if (source === "vite-client-manifest") {
					return await this.resolve(
						root + "/dist/client/.vite/manifest.json",
						importer,
						{ ...options, skipSelf: true },
					);
				}
			},
		},

		load: {
			filter: {
				id: /^\0virtual:vite-client-manifest$/,
			},
			async handler(id) {
				if (id === "\0virtual:vite-client-manifest") {
					return `export default {}`;
				}
			},
		},
	};
}

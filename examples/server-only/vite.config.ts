import type { UserConfig } from "vite";
import { fastly } from "vite-plugin-fastly";

export default {
	// This setting prevents Vite from serving index.html automatically.
	appType: "custom",
	// Configure only the SSR environment since this is a server-only example.
	environments: {
		ssr: {
			build: {
				rollupOptions: {
					input: "src/entry.fastly.ts",
				},
			},
		},
	},
	// Build only the SSR environment.
	builder: {
		async buildApp(builder) {
			await builder.build(builder.environments.ssr);
		},
	},
	// Add the Fastly plugin.
	plugins: [fastly()],
} satisfies UserConfig;

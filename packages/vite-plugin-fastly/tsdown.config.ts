import { defineConfig } from "tsdown";

export default defineConfig([
	{
		entry: { plugin: "./src/plugin/plugin.ts" },
		fixedExtension: false,
		format: ["esm"],
		platform: "node",
		target: "node20",
		sourcemap: true,
		dts: { build: true },
	},
	{
		entry: { runner: "./src/runner/runner.ts" },
		fixedExtension: false,
		deps: {
			neverBundle: [/^fastly:/],
		},
		format: ["esm"],
		platform: "neutral",
		target: "node20",
		sourcemap: true,
		dts: false,
	},
]);

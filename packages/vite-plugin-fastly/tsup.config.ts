import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: { plugin: "./src/plugin/plugin.ts" },
		format: ["esm"],
		platform: "node",
		target: "node20",
		sourcemap: true,
		dts: true,
	},
	{
		entry: { runner: "./src/runner/runner.ts" },
		external: [/^fastly:/],
		format: ["esm"],
		platform: "neutral",
		target: "node20",
		sourcemap: true,
		dts: false,
	},
]);

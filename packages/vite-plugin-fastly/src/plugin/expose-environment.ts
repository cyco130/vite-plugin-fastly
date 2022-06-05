import type { Plugin } from "vite";

export default function exposeEnvironment(): Plugin {
	let devServerUrl: string | undefined;
	let command: "serve" | "build";

	function getModuleContents(environmentName: string) {
		const url = devServerUrl ? JSON.stringify(devServerUrl) : "undefined";

		return (
			`export const name = ${JSON.stringify(environmentName)}\n` +
			`export const command = ${JSON.stringify(command)}\n` +
			`export const devServerUrl = ${url}`
		);
	}

	return {
		name: "vite-plugin-fastly/expose-environment",

		enforce: "pre",

		resolveId: {
			filter: {
				id: /^vite-plugin-fastly:environment$/,
			},
			handler(source) {
				if (source === "vite-plugin-fastly:environment") {
					return "\0virtual:vite-plugin-fastly:environment";
				}
			},
		},

		load: {
			filter: {
				id: /^\0virtual:vite-plugin-fastly:environment$/,
			},
			handler(id) {
				if (id !== "\0virtual:vite-plugin-fastly:environment") return;
				return getModuleContents(this.environment.name);
			},
		},

		configResolved(config) {
			command = config.command;
		},

		configureServer(server) {
			server.httpServer?.once("listening", () => {
				devServerUrl = server.resolvedUrls?.local[0];
			});
		},
	} satisfies Plugin;
}

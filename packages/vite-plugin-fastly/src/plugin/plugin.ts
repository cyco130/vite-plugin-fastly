import type { ConfigPluginContext, Connect, HttpServer, Plugin } from "vite";
import { createProxy, type ServerOptions } from "http-proxy-3";
import type { IncomingMessage } from "node:http";
import fs from "node:fs";
import { ChildProcess, execSync, spawn } from "node:child_process";
import { launchAndTest, type LaunchAndTestCleanupFunction } from "kill-em-all";
import exposeEnvironment from "./expose-environment";

export interface FastlyPluginOptions {
	/**
	 * A unique key to identify the plugin instance. This is required if you
	 * have multiple Fastly plugin instances in the same Vite configuration.
	 *
	 * @default "vite-plugin-fastly"
	 */
	uniqueName?: string;

	/**
	 * Vite environment name that the Fastly plugin should configure.
	 *
	 * @default "ssr"
	 */
	viteEnvironmentName?: string;

	/**
	 * Function that returns the command to build the Fastly Module Runner.
	 * The callback receives the input and output file paths.
	 *
	 * @default (input, output) => `js-compute-runtime ${input} ${output}`
	 */
	getRunnerBuildCommand?: (input: string, output: string) => string;

	/**
	 * IPv4 address of the Fastly Dev Server to proxy requests to during development.
	 * If you have multiple Fastly plugin instances, make sure each instance uses
	 * a unique address.
	 *
	 * @default "127.0.0.1:7676"
	 */
	fastlyDevServerAddress?: string;

	/**
	 * Function that returns the command to launch the Fastly Dev Server.
	 * The callback receives the compiled wasm file path and the address to bind to.
	 *
	 * @default (wasmFile, address) => `fastly compute serve --file=${wasmFile} --addr=${address}`
	 */
	getLaunchDevServerCommand?: (wasmFile: string, address: string) => string;

	/**
	 * Options to pass to the HTTP proxy server.
	 *
	 * @default {}
	 */
	proxyOptions?: ServerOptions;
}

// Map of uniqueName to Fastly Dev Server child processes
const fastlyProcesses = new Map<string, LaunchAndTestCleanupFunction>();

export function fastly(options: FastlyPluginOptions = {}): Plugin[] {
	const {
		uniqueName = "vite-plugin-fastly",
		viteEnvironmentName = "ssr",
		fastlyDevServerAddress = "127.0.0.1:7676",
		getRunnerBuildCommand = (input: string, output: string) =>
			`js-compute-runtime ${input} ${output}`,
		getLaunchDevServerCommand = (wasmFile, address) =>
			`fastly compute serve --file=${wasmFile} --addr=${address}`,
		proxyOptions = {},
	} = options;

	let command: "serve" | "build";
	let handlerEntry: string | undefined;
	let fastlyProcessKilled = false;
	let clientConfigured = false;
	let buildCommand: string | undefined;

	return [
		exposeEnvironment(),
		{
			name: uniqueName,

			config(_, env) {
				return {
					environments: {
						[viteEnvironmentName]: {
							optimizeDeps: {
								noDiscovery: false,
								exclude: [
									"fastly:acl",
									"fastly:backend",
									"fastly:cache",
									"fastly:cache-override",
									"fastly:compute",
									"fastly:config-store",
									"fastly:device",
									"fastly:dictionary",
									"fastly:edge-rate-limiter",
									"fastly:env",
									"fastly:experimental",
									"fastly:fanout",
									"fastly:geolocation",
									"fastly:html-rewriter",
									"fastly:image-optimizer",
									"fastly:kv-store",
									"fastly:logger",
									"fastly:secret-store",
									"fastly:websocket",
								],
								esbuildOptions: {
									platform: "neutral",
									minify: true,
									define: {
										"process.env.NODE_ENV": JSON.stringify(env.mode),
									},
								},
							},
							resolve: {
								builtins: [/^fastly:/],
								noExternal: true,
								conditions: ["fastly", "workerd"],
							},
							build: {
								rollupOptions: {
									output: {
										inlineDynamicImports: true,
									},
								},
							},
							dev: {},
						},
					},
				};
			},

			api: {
				fastly: {
					address: fastlyDevServerAddress,
				},
			},

			configResolved(config) {
				command = config.command;
				if (command !== "serve") return;

				// Scan plugins for multiple instances with the same uniqueName
				let sameNameInstanceCount = 0;
				let sameAddressInstanceCount = 0;
				for (const plugin of config.plugins) {
					if (plugin.name === uniqueName) {
						sameNameInstanceCount++;
					}
					if (plugin.api?.fastly?.address === fastlyDevServerAddress) {
						sameAddressInstanceCount++;
					}
				}

				if (sameNameInstanceCount > 1) {
					console.error(
						`[vite-plugin-fastly] Multiple Fastly plugin instances with the same uniqueName "${uniqueName}" detected.`,
					);
					console.error(
						`[vite-plugin-fastly] If you really need multiple instances, give each instance a unique "uniqueName".`,
					);
				}

				if (sameAddressInstanceCount > 1) {
					console.error(
						`[vite-plugin-fastly] Multiple Fastly plugin instances configured to use the same Fastly Dev Server address "${fastlyDevServerAddress}".`,
					);
					console.error(
						`[vite-plugin-fastly] If you really need multiple instances, give each instance a unique "fastlyDevServerAddress"`,
					);
				}

				if (sameNameInstanceCount > 1 || sameAddressInstanceCount > 1) {
					// This is a fatal error, we cannot continue
					process.exit(1);
				}

				const clientInput =
					config.environments.client?.build.rollupOptions.input;
				if (typeof clientInput === "string") {
					clientConfigured = true;
				} else if (Array.isArray(clientInput) && clientInput.length > 0) {
					clientConfigured = true;
				} else if (
					typeof clientInput === "object" &&
					clientInput !== null &&
					Object.keys(clientInput).length > 0
				) {
					clientConfigured = true;
				}
			},

			async configEnvironment(name, config, env) {
				if (name !== viteEnvironmentName || env.command !== "serve") {
					return;
				}

				const input = config.build?.rollupOptions?.input;
				if (typeof input === "string") {
					handlerEntry = input;
				} else if (Array.isArray(input)) {
					handlerEntry = input[0];
				} else if (typeof input === "object" && input !== null) {
					const values = Object.values(input);
					handlerEntry = values[0];
				}

				if (!handlerEntry) {
					return this.error(
						`[${uniqueName}] No entry point found in Rollup options. Please specify an input in environments.${viteEnvironmentName}.build.rollupOptions.input.`,
					);
				}

				// Kill previous Fastly Dev Server process if any
				fastlyProcessKilled = true;
				await doKillProcesses(this, uniqueName);

				const wasmFile = buildDevRunnerIfNecessary(
					this,
					uniqueName,
					getRunnerBuildCommand,
				);

				const launchCommand = getLaunchDevServerCommand(
					wasmFile,
					fastlyDevServerAddress,
				);

				this.info(`[${uniqueName}] Launching Fastly Dev Server with command:`);
				this.info(`[${uniqueName}] ${launchCommand}`);
				const fastlyDevServerProcess = await spawnCommand(launchCommand);

				const kill = await launchAndTest(
					fastlyDevServerProcess,
					`http://${fastlyDevServerAddress}/@vite-plugin-fastly/ready`,
				);

				fastlyProcesses.set(uniqueName, kill);

				this.info(
					`[${uniqueName}] Fastly Dev Server is running at http://${fastlyDevServerAddress}`,
				);
			},

			async writeBundle(outputOptions, bundle) {
				if (
					command !== "build" ||
					this.environment.name !== viteEnvironmentName
				) {
					return;
				}

				const jsFile = Object.values(bundle).find(
					(file) => file.type === "chunk" && file.isEntry,
				);
				if (!jsFile) {
					throw new Error(`[${uniqueName}] No JS entry chunk found in bundle.`);
				}

				const input = outputOptions.dir + "/" + jsFile.fileName;
				const output = outputOptions.dir + "/app.wasm";

				buildCommand = `js-compute-runtime ${input} ${output}`;
			},

			async closeBundle(error) {
				if (
					error ||
					command !== "build" ||
					this.environment.name !== viteEnvironmentName
				) {
					return;
				}

				this.info(`Building Fastly WASM module with command:`);
				this.info(buildCommand!);
				execSync(buildCommand!, { stdio: "inherit" });
			},

			async buildEnd() {
				if (command === "build" || fastlyProcessKilled) return;
				fastlyProcessKilled = true;
				await doKillProcesses(this, uniqueName);
			},

			configureServer(server) {
				const environment = server.environments[viteEnvironmentName]!;
				let address: string | null = null;

				server.httpServer?.on("listening", () => {
					address = getServerAddress(server.httpServer);
				});

				server.httpServer?.on("close", () => {
					address = null;
				});

				// Transport endpoint for the runner
				server.middlewares.use((req, res, next) => {
					if (
						req.method !== "POST" ||
						req.url !== "/@vite-plugin-fastly/transport"
					) {
						return next();
					}

					void (async () => {
						try {
							// Read the body
							const body = await readyBody(req);
							const data = JSON.parse(body);

							const result = await environment.hot.handleInvoke(data);

							res.setHeader("Content-Type", "application/json");
							res.end(JSON.stringify(result));
						} catch (error) {
							return next(error);
						}
					})();
				});

				const proxy = createProxy(proxyOptions);

				const proxyMiddleware: Connect.NextHandleFunction = (
					req,
					res,
					next,
				) => {
					if (!address) {
						return next(
							new Error(
								`[${uniqueName}] Vite server address is not available for proxying`,
							),
						);
					}

					try {
						proxy.web(
							req,
							res,
							{
								target: `http://${fastlyDevServerAddress}`,
								headers: {
									"Vite-Plugin-Fastly-Vite-Server-Address": address,
									"Vite-Plugin-Fastly-Handler-Entry": handlerEntry,
								},
							},
							(error) => {
								next(error);
							},
						);
					} catch (error) {
						next(error);
					}
				};

				// If a client build is configured, add the proxy middleware after Vite's own middlewares.
				// Otherwise, assume a pure server-side setup and add the proxy as the first middleware.
				if (clientConfigured) {
					return () => {
						server.middlewares.use(proxyMiddleware);
					};
				} else {
					server.middlewares.use(proxyMiddleware);
				}
			},
		},
	];
}

async function readyBody(req: IncomingMessage): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
		});

		req.on("end", () => {
			resolve(body);
		});

		req.on("error", (err) => {
			reject(err);
		});
	});
}

function getServerAddress(server: HttpServer | null): string | null {
	const address = server?.address();
	if (!address) {
		return null;
	}

	let host: string;

	if (typeof address === "string") {
		host = address;
	} else {
		switch (address.address) {
			case "127.0.0.1":
			case "::":
			case "::1":
			case "0000:0000:0000:0000:0000:0000:0000:0001":
				host = "localhost";
				break;
			default:
				host = address.address;
		}

		host = `http://${host}:${address.port}`;
	}

	return host;
}

function buildDevRunnerIfNecessary(
	ctx: ConfigPluginContext,
	uniqueName: string,
	getCommand: (input: string, output: string) => string,
): string {
	const jsComputeRuntimeVersion = getJsComputeRuntimeVersion(uniqueName);
	const input = "node_modules/vite-plugin-fastly/dist/runner.js";
	const output = `node_modules/.vite-plugin-fastly/runner.${jsComputeRuntimeVersion}.wasm`;

	const inputStat = fs.statSync(input);
	const outputStat = statOrNull(output);

	if (
		outputStat &&
		outputStat.isFile() &&
		outputStat.mtimeMs >= inputStat.mtimeMs
	) {
		// Up to date
		return output;
	}

	ctx.info(`[${uniqueName}] Building Fastly Module Runner for dev server...`);

	execSync(getCommand(input, output), { stdio: "inherit" });

	return output;
}

function getJsComputeRuntimeVersion(uniqueName: string): string {
	const output = execSync("js-compute-runtime --version").toString();

	// Parse version from something like "js-compute-runtime-cli.js 3.38.2\n"
	const lastSpaceIndex = output.lastIndexOf(" ");
	if (lastSpaceIndex === -1) {
		throw new Error(
			`[${uniqueName}] Unexpected js-compute-runtime version output: ${output}`,
		);
	}

	return output.slice(lastSpaceIndex + 1).trim();
}

function statOrNull(path: string): fs.Stats | null {
	try {
		return fs.statSync(path);
	} catch {
		return null;
	}
}

async function doKillProcesses(
	ctx: {
		info: (msg: string) => void;
	},
	name: string,
) {
	const kill = fastlyProcesses.get(name);
	if (!kill) return;

	fastlyProcesses.delete(name);

	ctx.info(`[${name}] Shutting down Fastly dev server`);
	await kill();
	ctx.info(`[${name}] Fastly dev server shut down`);
}

async function spawnCommand(command: string): Promise<ChildProcess> {
	const child = spawn(command, {
		shell: true,
		stdio: "inherit",
	});

	return await new Promise((resolve, reject) => {
		child.on("spawn", () => {
			if (!child.pid) {
				return reject(new Error("Failed to spawn process"));
			}

			resolve(child);
		});

		child.on("error", (err) => {
			reject(err);
		});
	});
}

let killAllInProgress = false;

async function killAll() {
	killAllInProgress = true;
	const promises: Promise<void>[] = [];
	for (const name of fastlyProcesses.keys()) {
		promises.push(
			doKillProcesses(
				{
					info: (msg: string) => {
						process.stdout.write(msg + "\n");
					},
				},
				name,
			),
		);
	}
	await Promise.all(promises);
}

function cleanupOnExit() {
	if (!killAllInProgress) {
		void killAll().finally(() => {
			process.exit(0);
		});
	}
}

process.on("SIGINT", cleanupOnExit);
process.on("SIGTERM", cleanupOnExit);
process.on("exit", cleanupOnExit);

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { ElementHandle } from "puppeteer";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import treeKill from "tree-kill-promise";

const DEV_HOST = `http://localhost:5173`;
const PREVIEW_HOST = `http://localhost:7676`;

const browser = await puppeteer.launch({
	headless: true,
	defaultViewport: { width: 1200, height: 800 },
});

const pages = await browser.pages();
const page = pages[0];

const cases: Array<{
	example: "server-only" | "client-server" | "react-ssr";
	env: "development" | "preview";
	hotReloadFile?: string;
}> = [
	{ example: "server-only", env: "development" },
	{ example: "server-only", env: "preview" },

	{
		example: "client-server",
		env: "development",
		hotReloadFile: "src/entry.client.ts",
	},
	{ example: "client-server", env: "preview" },

	{
		example: "react-ssr",
		env: "development",
		hotReloadFile: "src/components/CountButton.tsx",
	},
	{ example: "react-ssr", env: "preview" },
];

describe.each(cases)(
	"$example - $env",
	({ example: example, env, hotReloadFile }) => {
		const dir = path.resolve(
			__dirname,
			"..",
			"examples",
			example.toLowerCase(),
		);

		let cp: ChildProcess | undefined;

		const host = env === "development" ? DEV_HOST : PREVIEW_HOST;

		beforeAll(async () => {
			const command =
				env === "development"
					? `pnpm run dev`
					: `pnpm run build && pnpm run preview`;

			cp = spawn(command, {
				shell: true,
				stdio: "inherit",
				cwd: dir,
			});

			// eslint-disable-next-line no-async-promise-executor
			await new Promise<void>(async (resolve, reject) => {
				cp!.on("error", (error) => {
					reject(error);
				});

				cp!.on("exit", (code) => {
					if (code !== 0) {
						reject(new Error(`Process exited with code ${code}`));
					}
				});

				for (;;) {
					let doBreak = false;
					await fetch(host)
						.then(async (r) => {
							if (r.status === 200) {
								resolve();
								doBreak = true;
							}
						})
						.catch(() => {
							// Ignore error
						});

					if (doBreak) {
						break;
					}

					await new Promise((resolve) => setTimeout(resolve, 250));
				}
			}).catch((error) => {
				console.error(error);
				process.exit(1);
			});
		}, 60_000);

		afterAll(async () => {
			if (!cp || cp.exitCode || !cp.pid) {
				return;
			}

			await treeKill(cp.pid);

			if (cp.exitCode || !cp.pid) {
				return;
			}

			await new Promise((resolve, reject) => {
				cp!.on("exit", resolve);
				cp!.on("error", reject);
			});
		});

		test("renders page", async () => {
			await page.goto(host + "/");
			await page.waitForFunction(
				() =>
					document.querySelector("h1")?.textContent === "vite-plugin-fastly",
			);
		});

		if (hotReloadFile) {
			test("hot reloads page", async () => {
				await page.goto(host);

				const button: ElementHandle<HTMLButtonElement> =
					(await page.waitForSelector("button"))!;

				await button.click();

				await page.waitForFunction(
					() => document.querySelector("button")?.textContent === "Count: 1",
				);

				const filePath = path.resolve(dir, hotReloadFile);
				const oldContent = await fs.promises.readFile(filePath, "utf8");
				const newContent = oldContent.replace("Count:", "Hot count:");

				if (process.platform === "win32") {
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}

				await fs.promises.writeFile(filePath, newContent);

				try {
					await page.waitForFunction(
						() => document.body.textContent?.includes("Hot count: 1"),
						{ timeout: 60_000 },
					);
				} finally {
					await fs.promises.writeFile(filePath, oldContent);
				}
			}, 60_000);
		}
	},
);

afterAll(async () => {
	await browser.close();
});

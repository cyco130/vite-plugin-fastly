import { describe, test, beforeAll, afterAll } from "vitest";
import puppeteer, { ElementHandle } from "puppeteer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { launchAndTest, type LaunchAndTestCleanupFunction } from "kill-em-all";

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

		let cleanup: LaunchAndTestCleanupFunction | undefined;

		const host = env === "development" ? DEV_HOST : PREVIEW_HOST;

		beforeAll(async () => {
			const command =
				env === "development"
					? `pnpm run dev`
					: `pnpm run build && pnpm run preview`;

			const cp = spawn(command, {
				shell: true,
				stdio: "inherit",
				cwd: dir,
			});

			cleanup = await launchAndTest(cp, host);
		}, 60_000);

		afterAll(async () => {
			await cleanup?.();
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

declare module "vite-plugin-fastly:environment" {
	export const name: string;
	export const command: "serve" | "build";
	export const devServerUrl: string | undefined;
}

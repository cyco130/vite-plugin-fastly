import config from "@cyco130/eslint-config/node";

/** @type {typeof config} */
export default [
	...config,
	{
		ignores: [
			"dist/",
			"node_modules/",
			"tsup.config.ts",
			"lint-staged.config.mjs",
			"eslint.config.js",
			"types.d.ts",
		],
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
];

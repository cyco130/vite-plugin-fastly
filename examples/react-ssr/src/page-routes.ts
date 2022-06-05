import type { ComponentType } from "react";

export interface PageRouteModule {
	default: ComponentType<any>;
}

export interface Route {
	regexp: RegExp;
	importer: () => Promise<PageRouteModule>;
}

export const pageRoutes: Array<Route> = [
	{ regexp: /^\/$/, importer: async () => import("./routes/home.page") },
	{ regexp: /^\/foo\/?$/, importer: async () => import("./routes/foo.page") },
	{ regexp: /^\/bar\/?$/, importer: async () => import("./routes/bar.page") },
];

import { hydrateRoot } from "react-dom/client";
import { pageRoutes } from "./page-routes";
import { createElement } from "react";

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

const pathname = window.location.pathname;

for (const pageRoute of pageRoutes) {
	if (pageRoute.regexp.test(pathname)) {
		pageRoute.importer().then((module) => {
			const element = createElement(module.default);
			hydrateRoot(root, element);
		});
		break;
	}
}

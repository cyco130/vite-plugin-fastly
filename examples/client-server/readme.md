# `vite-plugin-fastly` Client-Server Example

This example demonstrates how to use the `vite-plugin-fastly` plugin in a full-stack client-server application. You can use it as a starting point for building Fastly Compute applications that serve both client-side assets and server-side logic, such as server-side rendering (SSR) applications or APIs with client interfaces. If you want to use React, check the [React SSR](../react-ssr/readme.md) example instead.

When a client entry point is specified via `environments.client.build.rollupOptions.input` in the Vite configuration, the plugin puts the Fastly server proxy _after_ the Vite's client assets server in the middleware stack. This allows the server to handle API requests while still serving client assets efficiently.

In the production build, your server-side code will need access to the client build's manifest file to correctly map entry module names into generated asset file names, e.g. `/entry.client.ts` into something like `/assets/entry.client-DB3Pp835.js`. The Vite config includes a small custom plugin to resolve the client manifest file path during the SSR build.

Check out the Vite configuration file [`vite.config.ts`](./vite.config.ts) for more details.

## Usage

```sh
# Clone the example
npx degit@latest cyco130/vite-plugin-fastly/examples/client-server

# Install dependencies
npm install

# Start the development server
npm run dev

# Build the project for production
npm run build

# Preview the production build locally
npm run preview

# Deploy the build to Fastly
npm run deploy
```

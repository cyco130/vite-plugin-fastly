# `vite-plugin-fastly` Server-Only Example

This example demonstrates how to use the `vite-plugin-fastly` plugin in a server-only context. You can use it as a starting point for building Fastly Compute applications that do not require client-side assets, like APIs or fully server-rendered applications that don't require client-side interactivity.

When no client entry points are specified via `environments.client.build.rollupOptions.input` in the Vite configuration, the plugin assumes a server-only application and puts the Fastly server proxy _before_ Vite's client assets server in the middleware stack. This setup essentially disables most client-specific Vite features.

Check out the Vite configuration file [`vite.config.ts`](./vite.config.ts) for more details.

## Usage

```sh
# Clone the example
npx degit@latest cyco130/vite-plugin-fastly/examples/server-only

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

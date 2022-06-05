# `vite-plugin-fastly`

`vite-plugin-fastly` is a [Vite](https://vite.dev/) plugin for developing and building [Fastly Compute JavaScript](https://www.fastly.com/documentation/guides/compute/developer-guides/javascript/) applications with Vite.

Fastly's official local development solution is the `fastly compute serve` command (available via the [Fastly CLI](https://www.fastly.com/documentation/reference/cli/)). It supports a `--watch` flag that rebuilds and reloads your application when source files change. However, this rebuild process can be slow since it involves bundling your application and compiling it to WebAssembly.

`vite-plugin-fastly` relies instead on Vite's [Environment API](https://vite.dev/guide/api-environment) to transform your source files on-the-fly during local development, resulting in a much faster feedback loop. It also enables access to Vite features like glob imports and the vast ecosystem of Vite plugins.

## Usage scenarios

You can use `vite-plugin-fastly` to build pure server-side Fastly Compute JavaScript applications, or full-stack applications that also include client-side code, for example a React application with SSR.

Check the starter examples:

- [Server-only](/examples/server-only/readme.md)
- [Client and server](/examples/client-server/readme.md)
- [React SSR](/examples/react-ssr/readme.md)

## How it works

During development, `vite-plugin-fastly` works by launching a remote module runner via `fastly compute serve` that communicates with the Vite development server to transform source files on-the-fly and run them via a Vite [`ModuleRunner`](https://vite.dev/guide/api-environment-runtimes#modulerunner). This runner, in turn, loads your entry module and passes incoming requests to it.

The plugin also adds a middleware to the Vite development server that proxies requests to the remote module runner. This proxy is placed _before_ Vite's own middlewares if you don't configure a client entry point via `environments.client.build.rollupOptions.input`, or _after_ if you do. When placed before, the setup essentially disables Vite's client-side features.

## Limitations

Fastly Compute JavaScript runtime (and its local emulator) has a heap size limit of 128MB. Since the plugin uses on-the-fly compilation, this means that large files or dependencies may cause out-of-memory errors during development.

`vite-plugin-fastly` tries to mitigate this by enabling minification during Vite's dependency pre-bundling. Using dynamic imports to lazy-load source files and dependencies can also help reduce per-request memory usage.

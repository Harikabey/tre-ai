import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { createReadStream, readFileSync } from "node:fs";
import path from "path";
import type { Plugin } from "vite";

const z3RuntimePlugin = (): Plugin => ({
  name: "tre-z3-runtime",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split("?")[0] !== "/z3-built.js") {
        next();
        return;
      }

      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      createReadStream(path.resolve(__dirname, "node_modules/z3-solver/build/z3-built.js"))
        .on("error", next)
        .pipe(response);
    });
  },
  buildStart() {
    this.emitFile({
      type: "asset",
      fileName: "z3-built.js",
      source: readFileSync(path.resolve(__dirname, "node_modules/z3-solver/build/z3-built.js")),
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  plugins: [react(), z3RuntimePlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@graphviz-wasm-wrapper": path.resolve(__dirname, "node_modules/graphviz-wasm/graphviz/wrapper.js"),
    },
  },
}));

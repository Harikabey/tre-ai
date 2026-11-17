import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { createReadStream, existsSync, readFileSync } from "node:fs";
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

const rigoutBridgeAssets = [
  ["treos_bridge.py", "treos_bridge.py"],
  ["baslat_kopru.bat", "baslat_kopru.bat"],
  ["baslat_kopru.sh", "baslat_kopru.sh"],
] as const;

const rigoutBridgeDownloadPlugin = (): Plugin => ({
  name: "treos-rigout-bridge-downloads",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathName = request.url?.split("?")[0];
      const asset = rigoutBridgeAssets.find(([, fileName]) =>
        pathName === `/treos-bridge/${fileName}`,
      );
      if (!asset) {
        next();
        return;
      }

      const [sourceName, fileName] = asset;
      response.setHeader(
        "Content-Type",
        fileName.endsWith(".py") ? "text/x-python; charset=utf-8" : "application/octet-stream",
      );
      response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      response.end(readFileSync(path.resolve(__dirname, sourceName)));
    });
  },
  buildStart() {
    for (const [sourceName, fileName] of rigoutBridgeAssets) {
      this.emitFile({
        type: "asset",
        fileName: `treos-bridge/${fileName}`,
        source: readFileSync(path.resolve(__dirname, sourceName)),
      });
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.TREOS_BRIDGE_EXE_AVAILABLE": JSON.stringify(
      existsSync(path.resolve(__dirname, "public/treos-bridge/TreOS-Bridge.exe")),
    ),
  },
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  plugins: [react(), z3RuntimePlugin(), rigoutBridgeDownloadPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@graphviz-wasm-wrapper": path.resolve(__dirname, "node_modules/graphviz-wasm/graphviz/wrapper.js"),
    },
  },
}));

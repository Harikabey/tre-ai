/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_TREOS_BRIDGE_EXE_AVAILABLE?: string;
  }
}

declare module '@graphviz-wasm-wrapper' {
  interface GraphvizInstance {
    layout(source: string, format: string, engine: string): string;
  }

  interface GraphvizRuntime {
    Graphviz: new () => GraphvizInstance;
    destroy(graph: GraphvizInstance): void;
  }

  const loadGraphviz: (moduleOverrides: {
    locateFile: (path: string, prefix: string) => string;
  }) => Promise<GraphvizRuntime>;
  export default loadGraphviz;
}

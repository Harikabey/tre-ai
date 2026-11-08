/// <reference types="vite/client" />

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

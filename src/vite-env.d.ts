/// <reference types="vite/client" />

// Allow importing Web Worker bundles via Vite’s `?worker` suffix.
// This lets us `import PdfWorker from './path/to/file?worker'` with correct typing.
declare module '*?worker' {
  const WorkerConstructor: {
    new (): Worker;
  };
  export default WorkerConstructor;
}

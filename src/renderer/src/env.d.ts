/// <reference types="vite/client" />

declare global {
  interface Window {
    viewerApi: {
      chooseFolder: () => Promise<string | null>
    }
  }
}

export {}

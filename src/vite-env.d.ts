/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

export interface ElectronStorageBridge {
  isElectron: boolean;
  saveData: (data: string) => Promise<{ success: boolean; error?: string }>;
  loadData: () => Promise<{ success: boolean; data: string | null; error?: string }>;
  getAppDataPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronStorage?: ElectronStorageBridge;
  }
}


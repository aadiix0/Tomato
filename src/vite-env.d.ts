/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

export interface ElectronStorageBridge {
  isElectron: boolean;
  saveData: (data: string) => Promise<{ success: boolean; error?: string }>;
  loadData: () => Promise<{ success: boolean; data: string | null; error?: string }>;
  getAppDataPath: () => Promise<string>;
}

export interface ElectronIslandTimerState {
  timeStr: string;
  progress: number;
  timerRunning: boolean;
  timerMode: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  infiniteFocus: boolean;
}

export interface ElectronIslandBridge {
  sendTimerState: (state: ElectronIslandTimerState) => void;
  onAction: (callback: (action: 'toggle' | 'skip') => void) => () => void;
  setVisible: (visible: boolean) => Promise<boolean>;
  getVisible: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronStorage?: ElectronStorageBridge;
    electronIsland?: ElectronIslandBridge;
  }
}


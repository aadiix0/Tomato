/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

export interface ElectronStorageBridge {
  isElectron: boolean;
  saveData: (data: string) => Promise<{ success: boolean; error?: string }>;
  loadData: () => Promise<{ success: boolean; data: string | null; error?: string }>;
  getAppDataPath: () => Promise<string>;
}

export type TaskbarIslandVisibilityMode = 'always' | 'when_closed_running' | 'when_closed' | 'off';

export interface ElectronIslandTimerState {
  timeStr: string;
  progress: number;
  timerRunning: boolean;
  timerMode: 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
  infiniteFocus: boolean;
  focusGoalMs: number;
  todayFocusMs: number;
  topicName: string;
  taskTitle: string | null;
}

export interface ElectronIslandBridge {
  sendTimerState: (state: ElectronIslandTimerState) => void;
  onAction: (callback: (action: 'toggle' | 'skip') => void) => () => void;
  setVisible: (visible: boolean) => Promise<boolean>;
  getVisible: () => Promise<boolean>;
  setVisibilityMode?: (mode: TaskbarIslandVisibilityMode) => Promise<TaskbarIslandVisibilityMode>;
  getVisibilityMode?: () => Promise<TaskbarIslandVisibilityMode>;
  onVisibilityModeChanged?: (callback: (mode: TaskbarIslandVisibilityMode) => void) => () => void;
}

declare global {
  interface Window {
    electronStorage?: ElectronStorageBridge;
    electronIsland?: ElectronIslandBridge;
  }
}


export type TopicShape =
  | 'COOKIE_7_SIDED'
  | 'CIRCLE'
  | 'SQUARE'
  | 'DIAMOND'
  | 'CLOVER_4_LEAF'
  | 'SUNNY'
  | 'FLOWER'
  | 'HEART'
  | 'PENTAGON'
  | 'BURST'
  | 'GEM'
  | 'PILL';

export const TOPIC_SHAPES: TopicShape[] = [
  'COOKIE_7_SIDED',
  'CIRCLE',
  'SQUARE',
  'DIAMOND',
  'CLOVER_4_LEAF',
  'SUNNY',
  'FLOWER',
  'HEART',
  'PENTAGON',
  'BURST',
  'GEM',
  'PILL',
];

export interface Topic {
  id: number;
  name: string;
  /** Hex color string, or '#ffffff' meaning "Default / App scheme" */
  color: string;
  shape: TopicShape;
  focusTime: number; // ms
  shortBreakTime: number; // ms
  longBreakTime: number; // ms
  sessionLength: number; // number of focus intervals before long break
  autostartNextSession: boolean;
  dndEnabled: boolean;
}

export const DEFAULT_TOPIC_ID = 1;

export const DEFAULT_TOPIC: Topic = {
  id: DEFAULT_TOPIC_ID,
  name: 'Default',
  color: '#ffffff',
  shape: 'COOKIE_7_SIDED',
  focusTime: 25 * 60 * 1000,
  shortBreakTime: 5 * 60 * 1000,
  longBreakTime: 15 * 60 * 1000,
  sessionLength: 4,
  autostartNextSession: false,
  dndEnabled: false,
};

/**
 * Focus durations for the 4 quarters of a day:
 * Q1: 00:00 - 12:00
 * Q2: 12:00 - 16:00
 * Q3: 16:00 - 20:00
 * Q4: 20:00 - 00:00
 */
export interface Stat {
  date: string; // YYYY-MM-DD
  topicId: number;
  focusTimeQ1: number;
  focusTimeQ2: number;
  focusTimeQ3: number;
  focusTimeQ4: number;
  breakTime: number;
}

export type TimerMode = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

export interface TimerState {
  timerMode: TimerMode;
  timeStr: string;
  totalTime: number;
  remainingTime: number;
  timerRunning: boolean;
  nextTimerMode: TimerMode;
  nextTimeStr: string;
  showBrandTitle: boolean;
  currentFocusCount: number;
  totalFocusCount: number;
  alarmRinging: boolean;
  infiniteFocus: boolean;
  cycles: number;
}

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface SettingsState {
  theme: ThemeMode;
  /** Hex color string, or '#ffffff' meaning default olive scheme */
  colorScheme: string;
  blackTheme: boolean;
  aodEnabled: boolean;
  alarmEnabled: boolean;
  vibrateEnabled: boolean;
  singleProgressBar: boolean;
  focusGoal: number; // ms
  desktopNotifications: boolean;
  keyboardShortcuts: boolean;
  keepScreenAwake: boolean;
  autoDriveSync: boolean;
  lastSyncedAt: string | null;
  celebrationsEnabled: boolean;
  productiveHoursReminderEnabled: boolean;
  productiveHoursStart: string; // HH:MM (24h)
  customBackgroundUrl: string;
  wallpaperOpacity: number; // 10 - 100 (%)
  wallpaperDim: number; // 0 - 90 (%)
  wallpaperBlur: number; // 0 - 20 (px)
  wallpaperFit: 'cover' | 'contain' | 'tile';
  wallpaperGlassCards: boolean;
  wallpaperVignette: boolean;
  timerLayoutStyle: 'wavy_circle' | 'minimalist_ring' | 'cyber_box' | 'clean_minimal';
  timerFontFamily: 'jakarta' | 'mono' | 'serif' | 'retro';
  timerPulseAnimation: boolean;
}

export const DEFAULT_SETTINGS: SettingsState = {
  theme: 'auto',
  colorScheme: '#ffffff',
  blackTheme: false,
  aodEnabled: false,
  alarmEnabled: true,
  vibrateEnabled: true,
  singleProgressBar: false,
  focusGoal: 0,
  desktopNotifications: false,
  keyboardShortcuts: true,
  keepScreenAwake: false,
  autoDriveSync: false,
  lastSyncedAt: null,
  celebrationsEnabled: true,
  productiveHoursReminderEnabled: false,
  productiveHoursStart: '09:00',
  customBackgroundUrl: '',
  wallpaperOpacity: 100,
  wallpaperDim: 40,
  wallpaperBlur: 0,
  wallpaperFit: 'cover',
  wallpaperGlassCards: true,
  wallpaperVignette: false,
  timerLayoutStyle: 'wavy_circle',
  timerFontFamily: 'jakarta',
  timerPulseAnimation: true,
};

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type TaskListType = 'today' | 'backlog' | 'done';

export interface Task {
  id: string;
  title: string;
  topicId: number;
  list: TaskListType;
  estimatedMinutes: number;
  actualMs: number;
  subtasks: Subtask[];
  createdAt: string;
  completedAt?: string;
}

export interface ColorSchemeOption {
  color: string;
  name: string;
}

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  { color: '#ffa79b', name: 'Red' },
  { color: '#ffb2bd', name: 'Rose' },
  { color: '#d7bbfc', name: 'Purple' },
  { color: '#c5c0ff', name: 'Indigo' },
  { color: '#b0c6ff', name: 'Blue' },
  { color: '#86d1ea', name: 'Cyan' },
  { color: '#82d5c7', name: 'Teal' },
  { color: '#9cd59f', name: 'Green' },
  { color: '#c3cd7c', name: 'Chartreuse' },
  { color: '#e8c16c', name: 'Yellow' },
  { color: '#ffb68d', name: 'Orange' },
];

export type MainTab = 'timer' | 'tasks' | 'stats' | 'settings';
export type StatsSubScreen = 'main' | 'last_week' | 'last_month' | 'last_year' | 'weekly_trend';
export type SettingsSubScreen =
  | 'main'
  | 'appearance'
  | 'appearance_wallpaper'
  | 'appearance_timer'
  | 'appearance_theme'
  | 'timer'
  | 'alarm'
  | 'topics'
  | 'advanced'
  | 'backup'
  | 'about';

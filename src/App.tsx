import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart2,
  BellOff,
  CheckCircle2,
  Cloud,
  GripHorizontal,
  ListTodo,
  Maximize2,
  Pause,
  PictureInPicture2,
  Play,
  Settings,
  SkipForward,
  Timer,
} from 'lucide-react';
import { useTomatoStore } from './store/useTomatoStore';
import { TimerScreen } from './components/TimerScreen';
import { TasksScreen } from './components/TasksScreen';
import { StatsScreen } from './components/StatsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { TopicModal } from './components/TopicModal';
import {
  CelebrationModal,
  type CelebrationVariant,
  type FocusSummaryData,
} from './components/CelebrationModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { applyPaletteToRoot, buildPalette, resolveIsDark } from './utils/theme';
import { millisecondsToHoursMinutes, toLocalDateKey, totalFocusOfStat } from './utils/time';
import {
  findDriveBackupFile,
  getAccessToken,
  initAuth,
  uploadDriveBackup,
} from './services/googleDriveSync';
import type { MainTab, SettingsSubScreen, StatsSubScreen, Topic } from './types';

export function App() {
  const store = useTomatoStore();
  const [activeTab, setActiveTab] = useState<MainTab>('timer');
  const [statsSub, setStatsSub] = useState<StatsSubScreen>('main');
  const [settingsSub, setSettingsSub] = useState<SettingsSubScreen>('main');
  const [topicModal, setTopicModal] = useState<{ open: boolean; editing?: Topic; setAsCurrent?: boolean }>({
    open: false,
  });
  const [aodMode, setAodMode] = useState(false);
  const [miniTimerMode, setMiniTimerMode] = useState(false);
  const [miniPos, setMiniPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStateRef = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });
  const [celebration, setCelebration] = useState<{
    title: string;
    subtitle?: string;
    variant: CelebrationVariant;
    focusSummary?: FocusSummaryData;
  } | null>(null);
  const [pipNotice, setPipNotice] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<{ message: string; icon?: 'cloud' | 'check' | 'alert' } | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const prevAlarmRef = useRef(false);

  const showToast = useCallback((message: string, icon: 'cloud' | 'check' | 'alert' = 'cloud') => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToastNotice({ message, icon });
    toastTimeoutRef.current = window.setTimeout(() => setToastNotice(null), 4000);
  }, []);

  useEffect(() => {
    const unsub = initAuth(
      (user) => setCurrentUserEmail(user.email || user.displayName || 'Google Account'),
      () => setCurrentUserEmail(null)
    );
    return () => unsub();
  }, []);

  // Apply dynamic Material 3 Expressive color palette
  useEffect(() => {
    const updateTheme = () => {
      const isDark = resolveIsDark(store.settings.theme);
      const effectiveSeed =
        activeTab === 'timer' && store.currentTopic.color.toLowerCase() !== '#ffffff'
          ? store.currentTopic.color
          : store.settings.colorScheme;
      const palette = buildPalette(effectiveSeed, isDark, store.settings.blackTheme);
      const isGlass = Boolean(
        store.settings.customBackgroundUrl && (store.settings.wallpaperGlassCards ?? true)
      );
      applyPaletteToRoot(palette, isGlass);
    };
    updateTheme();

    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (mq && store.settings.theme === 'auto') {
      mq.addEventListener('change', updateTheme);
      return () => mq.removeEventListener('change', updateTheme);
    }
  }, [
    store.settings.theme,
    store.settings.colorScheme,
    store.settings.blackTheme,
    store.settings.customBackgroundUrl,
    store.settings.wallpaperGlassCards,
    store.currentTopic.color,
    activeTab,
  ]);

  // Update browser tab title when timer is running
  useEffect(() => {
    if (store.timerState.timerRunning) {
      const modeLabel =
        store.timerState.timerMode === 'FOCUS'
          ? 'Focus'
          : store.timerState.timerMode === 'SHORT_BREAK'
            ? 'Short Break'
            : 'Long Break';
      document.title = `${store.timerState.timeStr} · ${modeLabel} — Zonein`;
    } else {
      document.title = 'Zonein';
    }
  }, [store.timerState.timerRunning, store.timerState.timeStr, store.timerState.timerMode]);

  // Sync live timer state to the Windows Taskbar Dynamic Island (Electron)
  useEffect(() => {
    window.electronIsland?.sendTimerState({
      timeStr: store.timerState.timeStr,
      progress: store.progress,
      timerRunning: store.timerState.timerRunning,
      timerMode: store.timerState.timerMode,
      infiniteFocus: store.timerState.infiniteFocus,
    });
  }, [
    store.timerState.timeStr,
    store.progress,
    store.timerState.timerRunning,
    store.timerState.timerMode,
    store.timerState.infiniteFocus,
  ]);

  // Handle Play/Pause and Skip actions from the Windows Taskbar Dynamic Island
  useEffect(() => {
    if (!window.electronIsland) return;
    return window.electronIsland.onAction((action) => {
      if (action === 'toggle') {
        store.toggleTimer();
      } else if (action === 'skip') {
        store.skipTimer();
      }
    });
  }, [store.toggleTimer, store.skipTimer]);

  // Desktop keyboard shortcuts (Space: Play/Pause, R: Reset, S: Skip)
  useEffect(() => {
    if (!store.settings.keyboardShortcuts) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || topicModal.open) return;
      if (e.code === 'Space') {
        e.preventDefault();
        store.toggleTimer();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        store.resetTimer();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        store.skipTimer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store.settings.keyboardShortcuts, store.toggleTimer, store.resetTimer, store.skipTimer, topicModal.open]);

  // Desktop notification when interval completes
  useEffect(() => {
    if (
      store.timerState.alarmRinging &&
      store.settings.desktopNotifications &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const nextLabel =
        store.timerState.timerMode === 'FOCUS'
          ? 'Time to focus!'
          : store.timerState.timerMode === 'SHORT_BREAK'
            ? 'Time for a short break!'
            : 'Time for a long break!';
      new Notification('Zonein', { body: nextLabel, icon: '/pwa-192x192.png' });
    }
  }, [store.timerState.alarmRinging, store.timerState.timerMode, store.settings.desktopNotifications]);

  // Daily desktop notification at the start of productive hours to prompt setting a focus goal
  useEffect(() => {
    if (
      !store.settings.productiveHoursReminderEnabled ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const checkAndNotify = () => {
      const todayKey = toLocalDateKey();
      if (localStorage.getItem('tomato_productive_reminder_date') === todayKey) return;

      const [targetH, targetM] = (store.settings.productiveHoursStart || '09:00')
        .split(':')
        .map((n) => Number(n));
      if (Number.isNaN(targetH) || Number.isNaN(targetM)) return;

      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const targetMins = targetH * 60 + targetM;

      if (nowMins >= targetMins) {
        localStorage.setItem('tomato_productive_reminder_date', todayKey);
        const n = new Notification('Time to lock in — Zonein', {
          body: 'Your productive hours have started! Set your daily focus goal and crush today’s sessions.',
          icon: '/pwa-192x192.png',
        });
        n.onclick = () => {
          window.focus();
          setActiveTab('settings');
          setSettingsSub('timer');
          n.close();
        };
      }
    };

    checkAndNotify();
    const id = window.setInterval(checkAndNotify, 30000);
    return () => window.clearInterval(id);
  }, [store.settings.productiveHoursReminderEnabled, store.settings.productiveHoursStart]);

  // Show celebration or motivation meme/GIF when a focus session or break completes
  useEffect(() => {
    const ringing = store.timerState.alarmRinging;
    const justCompleted = ringing && !prevAlarmRef.current;
    prevAlarmRef.current = ringing;

    if (justCompleted && store.settings.celebrationsEnabled) {
      if (store.timerState.timerMode === 'FOCUS') {
        setCelebration({
          variant: 'break_complete',
          title: `Back to ${store.currentTopic.name}`,
          subtitle: `Session ${store.timerState.currentFocusCount} of ${store.timerState.totalFocusCount} · Let's lock in!`,
        });
      } else {
        const breakLabel =
          store.timerState.timerMode === 'LONG_BREAK' ? 'long break' : 'short break';
        const todayKey = toLocalDateKey();
        const todayFocusMs = store.stats
          .filter((s) => s.date === todayKey)
          .reduce((sum, s) => sum + totalFocusOfStat(s), 0);
        setCelebration({
          variant: 'focus_complete',
          title: `${store.currentTopic.name} · Session ${store.timerState.currentFocusCount}/${store.timerState.totalFocusCount}`,
          subtitle: `Great focus! Enjoy your ${breakLabel}.`,
          focusSummary: {
            sessionMs: store.currentTopic.focusTime,
            todayTotalMs: todayFocusMs,
            dailyGoalMs: store.settings.focusGoal,
          },
        });
      }
    }
  }, [
    store.timerState.alarmRinging,
    store.timerState.timerMode,
    store.timerState.currentFocusCount,
    store.timerState.totalFocusCount,
    store.currentTopic.name,
    store.currentTopic.focusTime,
    store.stats,
    store.settings.focusGoal,
    store.settings.celebrationsEnabled,
  ]);

  // Trigger Cats-only celebration when Daily Focus Goal is reached for the first time today
  useEffect(() => {
    if (!store.settings.celebrationsEnabled || store.settings.focusGoal <= 0) return;
    const todayKey = toLocalDateKey();
    const celebratedDate = localStorage.getItem('tomato_goal_celebrated_date');
    if (celebratedDate === todayKey) return;

    const todayFocusMs = store.stats
      .filter((s) => s.date === todayKey)
      .reduce((sum, s) => sum + totalFocusOfStat(s), 0);

    if (todayFocusMs >= store.settings.focusGoal) {
      localStorage.setItem('tomato_goal_celebrated_date', todayKey);
      setCelebration({
        variant: 'daily_goal',
        title: `You hit your ${millisecondsToHoursMinutes(store.settings.focusGoal)} daily goal!`,
        subtitle: 'Cats-only celebration unlocked for today.',
        focusSummary: {
          sessionMs: store.currentTopic.focusTime,
          todayTotalMs: todayFocusMs,
          dailyGoalMs: store.settings.focusGoal,
        },
      });
    }
  }, [store.stats, store.settings.focusGoal, store.settings.celebrationsEnabled, store.currentTopic.focusTime]);

  // Screen Wake Lock while timer is running
  useEffect(() => {
    if (!store.settings.keepScreenAwake || !store.timerState.timerRunning) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as {
      wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock?.request('screen').then((s) => {
      sentinel = s;
    }).catch(() => {});
    return () => {
      void sentinel?.release();
    };
  }, [store.settings.keepScreenAwake, store.timerState.timerRunning]);

  // Automatic Google Drive sync (debounced) when enabled and signed in
  useEffect(() => {
    if (!store.settings.autoDriveSync) return;
    const token = getAccessToken();
    if (!token) return;

    const timerId = window.setTimeout(async () => {
      try {
        const existing = await findDriveBackupFile(token);
        const saved = await uploadDriveBackup(token, store.exportBackupJson(), existing?.id);
        store.updateSettings({ lastSyncedAt: saved.modifiedTime ?? new Date().toISOString() });
      } catch {
        // Silent retry on next data change
      }
    }, 4000);

    return () => window.clearTimeout(timerId);
  }, [
    store.settings.autoDriveSync,
    store.topics,
    store.stats,
    store.tasks,
    store.tags,
    store.settings.theme,
    store.settings.colorScheme,
    store.settings.blackTheme,
    store.settings.timerLayoutStyle,
    store.settings.breakTimerLayoutStyle,
    store.settings.timerFontFamily,
    store.settings.timerPulseAnimation,
    store.settings.timerDigitGlow,
    store.settings.customBackgroundUrl,
    store.settings.wallpaperDim,
    store.settings.wallpaperBlur,
    store.settings.wallpaperOpacity,
    store.settings.wallpaperFit,
    store.settings.wallpaperGlassCards,
    store.settings.wallpaperVignette,
    store.settings.focusGoal,
    store.settings.alarmEnabled,
    store.settings.vibrateEnabled,
    store.settings.desktopNotifications,
    store.settings.keyboardShortcuts,
    store.settings.keepScreenAwake,
    store.exportBackupJson,
    store.updateSettings,
  ]);

  // Draw live timer onto offscreen Canvas for universal Video Picture-in-Picture
  const drawPipCanvas = useCallback(() => {
    const canvas = pipCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const focusMode = store.timerState.timerMode === 'FOCUS';
    const accent = focusMode ? '#d0bcff' : '#9cd59f';

    // Background
    ctx.fillStyle = '#141318';
    ctx.fillRect(0, 0, w, h);

    // Subtle top accent bar
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 6);

    // Mode + Topic/Task label
    const modeLabel =
      store.timerState.timerMode === 'FOCUS'
        ? store.timerState.infiniteFocus
          ? 'INFINITE FOCUS'
          : `FOCUS · ${store.timerState.currentFocusCount}/${store.timerState.totalFocusCount}`
        : store.timerState.timerMode === 'SHORT_BREAK'
          ? 'SHORT BREAK'
          : 'LONG BREAK';

    ctx.fillStyle = accent;
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(modeLabel, w / 2, 54);

    // Main countdown digits
    ctx.fillStyle = '#f4eff4';
    ctx.font = '800 112px system-ui, -apple-system, sans-serif';
    ctx.fillText(store.timerState.timeStr, w / 2, 168);

    // Topic or Active Task name
    const subLabel = store.activeTask ? store.activeTask.title : store.currentTopic.name;
    ctx.fillStyle = 'rgba(244, 239, 244, 0.72)';
    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(subLabel.slice(0, 28), w / 2, 212);

    // Progress bar
    const barX = 48;
    const barY = 238;
    const barW = w - 96;
    const barH = 12;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    const fillW = Math.max(0, Math.min(1, store.progress)) * barW;
    if (fillW > 0) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 6);
      ctx.fill();
    }
  }, [
    store.timerState.timerMode,
    store.timerState.infiniteFocus,
    store.timerState.currentFocusCount,
    store.timerState.totalFocusCount,
    store.timerState.timeStr,
    store.activeTask,
    store.currentTopic.name,
    store.progress,
  ]);

  // Keep Document PiP and Canvas Video PiP in sync with timer updates
  useEffect(() => {
    const pipWin = pipWindowRef.current;
    if (pipWin && !pipWin.closed) {
      const timeEl = pipWin.document.getElementById('pip-time');
      const labelEl = pipWin.document.getElementById('pip-label');
      const btnEl = pipWin.document.getElementById('pip-toggle');
      if (timeEl) timeEl.textContent = store.timerState.timeStr;
      if (labelEl) {
        labelEl.textContent = store.activeTask ? store.activeTask.title : store.currentTopic.name;
      }
      if (btnEl) btnEl.textContent = store.timerState.timerRunning ? 'Pause' : 'Resume';
    }
    if (document.pictureInPictureElement && pipVideoRef.current === document.pictureInPictureElement) {
      drawPipCanvas();
    }
  }, [
    store.timerState.timeStr,
    store.timerState.timerRunning,
    store.activeTask,
    store.currentTopic.name,
    drawPipCanvas,
  ]);

  const handleOpenVideoPiP = useCallback(async (): Promise<boolean> => {
    try {
      if (!document.pictureInPictureEnabled) return false;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return true;
      }
      let canvas = pipCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        pipCanvasRef.current = canvas;
      }
      drawPipCanvas();

      let video = pipVideoRef.current;
      if (!video) {
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = canvas.captureStream(5);
        pipVideoRef.current = video;
      }
      await video.play();
      await video.requestPictureInPicture();

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('play', () => store.toggleTimer());
          navigator.mediaSession.setActionHandler('pause', () => store.toggleTimer());
          navigator.mediaSession.setActionHandler('nexttrack', () => store.skipTimer());
        } catch {
          // Ignore unsupported mediaSession actions
        }
      }
      return true;
    } catch {
      return false;
    }
  }, [drawPipCanvas, store]);

  const handleOpenExternalPiP = useCallback(async (): Promise<boolean> => {
    const dpip = (window as unknown as {
      documentPictureInPicture?: {
        requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
      };
    }).documentPictureInPicture;

    if (!dpip || window.self !== window.top) {
      return false;
    }

    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.focus();
        return true;
      }
      const pipWin = await dpip.requestWindow({ width: 290, height: 156 });
      pipWindowRef.current = pipWin;
      pipWin.document.body.style.margin = '0';
      pipWin.document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      pipWin.document.body.style.background = '#1c1b1f';
      pipWin.document.body.style.color = '#f4eff4';
      pipWin.document.body.style.display = 'flex';
      pipWin.document.body.style.flexDirection = 'column';
      pipWin.document.body.style.alignItems = 'center';
      pipWin.document.body.style.justifyContent = 'center';
      pipWin.document.body.style.height = '100vh';
      pipWin.document.body.style.gap = '6px';
      pipWin.document.body.style.padding = '12px';
      pipWin.document.body.style.boxSizing = 'border-box';

      const label = pipWin.document.createElement('div');
      label.id = 'pip-label';
      label.style.fontSize = '12px';
      label.style.opacity = '0.75';
      label.style.maxWidth = '250px';
      label.style.whiteSpace = 'nowrap';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.textContent = store.activeTask ? store.activeTask.title : store.currentTopic.name;

      const time = pipWin.document.createElement('div');
      time.id = 'pip-time';
      time.style.fontSize = '42px';
      time.style.fontWeight = '800';
      time.style.fontVariantNumeric = 'tabular-nums';
      time.style.lineHeight = '1';
      time.textContent = store.timerState.timeStr;

      const controls = pipWin.document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '8px';
      controls.style.marginTop = '4px';

      const btn = pipWin.document.createElement('button');
      btn.id = 'pip-toggle';
      btn.textContent = store.timerState.timerRunning ? 'Pause' : 'Resume';
      btn.style.padding = '6px 18px';
      btn.style.borderRadius = '999px';
      btn.style.border = 'none';
      btn.style.background = '#d0bcff';
      btn.style.color = '#381e72';
      btn.style.fontWeight = '700';
      btn.style.fontSize = '12px';
      btn.style.cursor = 'pointer';
      btn.onclick = () => store.toggleTimer();

      const skipBtn = pipWin.document.createElement('button');
      skipBtn.textContent = 'Skip';
      skipBtn.style.padding = '6px 14px';
      skipBtn.style.borderRadius = '999px';
      skipBtn.style.border = 'none';
      skipBtn.style.background = '#313033';
      skipBtn.style.color = '#e6e1e5';
      skipBtn.style.fontWeight = '700';
      skipBtn.style.fontSize = '12px';
      skipBtn.style.cursor = 'pointer';
      skipBtn.onclick = () => store.skipTimer();

      controls.append(btn, skipBtn);
      pipWin.document.body.append(label, time, controls);
      return true;
    } catch {
      return false;
    }
  }, [store]);

  const handleOpenPiP = useCallback(async () => {
    // 1. Try real interactive Document PiP (Chrome/Edge)
    const openedDocPip = await handleOpenExternalPiP();
    if (openedDocPip) return;

    // 2. Try universal OS-level Video PiP (works across tabs & apps)
    const openedVideoPip = await handleOpenVideoPiP();
    if (openedVideoPip) return;

    // 3. Fallback to in-app Mini-Timer if browser/sandbox blocks PiP
    setMiniPos({ x: 0, y: 0 });
    setMiniTimerMode(true);
    setPipNotice('Floating PiP is blocked in this view — using in-app Mini-Timer.');
    window.setTimeout(() => setPipNotice(null), 3500);
  }, [handleOpenExternalPiP, handleOpenVideoPiP]);

  const handleCompleteTask = useCallback(
    (taskId: string) => {
      const task = store.tasks.find((t) => t.id === taskId);
      store.completeTask(taskId);
      if (task && store.settings.celebrationsEnabled) {
        const actualMin = Math.round(task.actualMs / 60000);
        const subtitle =
          actualMin > 0
            ? `Estimated ${task.estimatedMinutes}m · Actual ${actualMin}m`
            : `Estimated ${task.estimatedMinutes}m`;
        setCelebration({ variant: 'task', title: task.title, subtitle });
      }
    },
    [store]
  );

  const isFocus = store.timerState.timerMode === 'FOCUS';
  const toolbarBg = isFocus ? 'var(--m3-primary-container)' : 'var(--m3-tertiary-container)';
  const toolbarFg = isFocus ? 'var(--m3-on-primary-container)' : 'var(--m3-on-tertiary-container)';
  const toolbarActiveBg = isFocus ? 'var(--m3-primary)' : 'var(--m3-tertiary)';
  const toolbarActiveFg = isFocus ? 'var(--m3-on-primary)' : 'var(--m3-on-tertiary)';

  const navItems: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: 'timer', label: 'Timer', icon: <Timer size={20} /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo size={20} /> },
    { id: 'stats', label: 'Stats', icon: <BarChart2 size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const isDark = resolveIsDark(store.settings.theme);
  const hasCustomBg = Boolean(store.settings.customBackgroundUrl);

  const bgOpacity = (store.settings.wallpaperOpacity ?? 100) / 100;
  const bgDim = (store.settings.wallpaperDim ?? 40) / 100;
  const bgBlur = store.settings.wallpaperBlur ?? 0;
  const bgFit = store.settings.wallpaperFit ?? 'cover';
  const hasVignette = Boolean(store.settings.wallpaperVignette);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {hasCustomBg && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
          {/* Wallpaper image layer with opacity, blur, and scale */}
          <div
            className="absolute inset-0 transition-[opacity,filter] duration-300"
            style={{
              backgroundImage: `url("${store.settings.customBackgroundUrl}")`,
              backgroundPosition: 'center',
              backgroundSize: bgFit === 'tile' ? 'auto' : bgFit,
              backgroundRepeat: bgFit === 'tile' ? 'repeat' : 'no-repeat',
              opacity: bgOpacity,
              filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none',
              transform: bgBlur > 0 ? 'scale(1.06)' : 'none',
            }}
          />

          {/* Theme & user-controlled dimming overlay */}
          <div
            className="absolute inset-0 transition-colors duration-300"
            style={{
              backgroundColor: isDark
                ? `rgba(0, 0, 0, ${bgDim})`
                : `rgba(255, 255, 255, ${Math.min(0.95, bgDim * 0.9 + 0.1)})`,
            }}
          />

          {/* Optional cinematic edge vignette */}
          {hasVignette && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background:
                  'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.72) 100%)',
              }}
            />
          )}
        </div>
      )}
      <div className="relative z-10 min-h-screen flex flex-col">
        {!aodMode && !miniTimerMode && (
          <div className="fixed bottom-5 right-4 z-40 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
                setSettingsSub('backup');
              }}
              title={
                currentUserEmail
                  ? `Google Drive Sync: ${currentUserEmail} · Click to manage`
                  : 'Connect Google Drive for cross-PC auto backup'
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md shadow-md border transition-all hover:scale-105 cursor-pointer"
              style={{
                backgroundColor: currentUserEmail
                  ? 'var(--m3-primary-container)'
                  : 'var(--m3-surface-container-high)',
                color: currentUserEmail
                  ? 'var(--m3-on-primary-container)'
                  : 'var(--m3-on-surface)',
                borderColor: 'var(--m3-outline-variant)',
              }}
            >
              <Cloud size={14} className={currentUserEmail ? 'text-emerald-500' : ''} />
              <span className="hidden sm:inline">
                {currentUserEmail ? 'Drive Synced' : 'Drive Sync'}
              </span>
            </button>
            <PWAInstallButton />
          </div>
        )}

        {/* Global Toast for Cloud Auto-Sync & Restores */}
        {toastNotice && (
          <div
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl border transition-all animate-in fade-in slide-in-from-top duration-300"
            style={{
              backgroundColor: 'var(--m3-primary-container)',
              color: 'var(--m3-on-primary-container)',
              borderColor: 'var(--m3-primary)',
            }}
          >
            {toastNotice.icon === 'check' ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : (
              <Cloud size={16} className="shrink-0" style={{ color: 'var(--m3-primary)' }} />
            )}
            <span>{toastNotice.message}</span>
          </div>
        )}
      {!miniTimerMode && activeTab === 'timer' && (
        <TimerScreen
          timerState={store.timerState}
          topics={store.topics}
          currentTopic={store.currentTopic}
          tags={store.tags}
          activeTagIds={store.activeTagIds}
          activeTask={store.activeTask}
          sessionActive={store.sessionActive}
          progress={store.progress}
          aodEnabled={store.settings.aodEnabled}
          hasCustomBg={hasCustomBg}
          isDark={isDark}
          timerLayoutStyle={store.settings.timerLayoutStyle ?? 'wavy_circle'}
          breakTimerLayoutStyle={store.settings.breakTimerLayoutStyle ?? 'wavy_circle'}
          timerFontFamily={store.settings.timerFontFamily ?? 'jakarta'}
          timerPulseAnimation={store.settings.timerPulseAnimation ?? true}
          timerDigitGlow={store.settings.timerDigitGlow ?? false}
          onToggleTimer={store.toggleTimer}
          onResetTimer={store.resetTimer}
          onUndoReset={store.undoReset}
          onSkipTimer={store.skipTimer}
          onToggleInfiniteFocus={store.toggleInfiniteFocus}
          onSelectTopic={store.selectTopic}
          onToggleActiveTag={store.toggleActiveTag}
          onCreateTag={store.createTag}
          onCompleteActiveTask={() => {
            if (store.activeTask) handleCompleteTask(store.activeTask.id);
          }}
          onOpenPiP={handleOpenPiP}
          onSendNoteToBacklog={(title) => {
            store.createTask(title, 25, store.currentTopic.id, 'backlog', store.activeTagIds);
          }}
          onAddTopic={() => setTopicModal({ open: true, setAsCurrent: true })}
          onOpenTopicSettings={() => {
            setActiveTab('settings');
            setSettingsSub('topics');
          }}
          onEnterAod={() => {
            if (!store.timerState.timerRunning) store.toggleTimer();
            setAodMode(true);
          }}
        />
      )}

      {!miniTimerMode && activeTab === 'tasks' && (
        <TasksScreen
          tasks={store.tasks}
          topics={store.topics}
          tags={store.tags}
          activeTaskId={store.activeTaskId}
          hasCustomBg={hasCustomBg}
          onCreateTask={store.createTask}
          onUpdateTaskTags={store.updateTaskTags}
          onCreateTag={store.createTag}
          onDeleteTask={store.deleteTask}
          onMoveTask={store.moveTask}
          onCompleteTask={handleCompleteTask}
          onBlitzTask={(taskId) => {
            store.blitzTask(taskId);
            setActiveTab('timer');
          }}
          onAddSubtask={store.addSubtask}
          onToggleSubtask={store.toggleSubtask}
        />
      )}

      {!miniTimerMode && activeTab === 'stats' && (
        <StatsScreen
          stats={store.stats}
          topics={store.topics}
          tasks={store.tasks}
          tags={store.tags}
          focusGoal={store.settings.focusGoal}
          subScreen={statsSub}
          hasCustomBg={hasCustomBg}
          onNavigate={setStatsSub}
        />
      )}

      {!miniTimerMode && activeTab === 'settings' && (
        <SettingsScreen
          settings={store.settings}
          topics={store.topics}
          tags={store.tags}
          tasks={store.tasks}
          subScreen={settingsSub}
          lastModified={store.lastModified}
          isPristine={store.isPristine}
          onNavigate={setSettingsSub}
          onUpdateSettings={store.updateSettings}
          onAddTopic={() => setTopicModal({ open: true, setAsCurrent: false })}
          onEditTopic={(topic) => setTopicModal({ open: true, editing: topic })}
          onDeleteTopic={store.deleteTopic}
          onCreateTag={store.createTag}
          onUpdateTag={store.updateTag}
          onDeleteTag={store.deleteTag}
          onEraseAllData={store.eraseAllData}
          onExportBackup={store.exportBackupJson}
          onImportBackup={store.importBackupJson}
          onShowToast={showToast}
          onPreviewCelebration={(variant) => {
            const titles: Record<CelebrationVariant, { title: string; subtitle: string }> = {
              task: { title: 'Sample Task Completed!', subtitle: 'Estimated 25m · Actual 22m' },
              focus_complete: {
                title: `${store.currentTopic.name} · Session 1/4`,
                subtitle: 'Great focus! Enjoy your short break.',
              },
              break_complete: {
                title: `Back to ${store.currentTopic.name}`,
                subtitle: "Break's over · Let's lock in!",
              },
              daily_goal: {
                title: 'You hit your daily focus goal!',
                subtitle: 'Cats-only celebration unlocked for today.',
              },
            };
            const todayKey = toLocalDateKey();
            const todayFocusMs = store.stats
              .filter((s) => s.date === todayKey)
              .reduce((sum, s) => sum + totalFocusOfStat(s), 0);
            const summary =
              variant === 'focus_complete' || variant === 'daily_goal'
                ? {
                    sessionMs: store.currentTopic.focusTime,
                    todayTotalMs: Math.max(todayFocusMs, store.currentTopic.focusTime),
                    dailyGoalMs: store.settings.focusGoal,
                  }
                : undefined;
            setCelebration({ variant, ...titles[variant], focusSummary: summary });
          }}
        />
      )}

      {/* Floating Material 3 Expressive Bottom Toolbar (Compact Icon Dock, Expands on Hover) */}
      {!aodMode && !miniTimerMode && (
        <nav
          aria-label="Primary navigation"
          className="group fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 hover:p-1.5 rounded-full shadow-lg transition-all duration-300"
          style={{
            backgroundColor: toolbarBg,
            color: toolbarFg,
          }}
        >
          {navItems.map((item) => {
            const selected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => {
                  if (selected) {
                    if (item.id === 'stats') setStatsSub('main');
                    if (item.id === 'settings') setSettingsSub('main');
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className="h-10 group-hover:h-11 px-3 group-hover:px-4 rounded-full flex items-center font-semibold text-sm transition-all duration-300 cursor-pointer"
                style={{
                  backgroundColor: selected ? toolbarActiveBg : 'transparent',
                  color: selected ? toolbarActiveFg : toolbarFg,
                }}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Alarm Ringing Overlay */}
      {store.timerState.alarmRinging && (
        <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div
            className="flex items-center gap-4 px-6 py-4 rounded-full shadow-2xl"
            style={{
              backgroundColor: 'var(--m3-error-container)',
              color: 'var(--m3-on-error-container)',
            }}
          >
            <span className="font-bold">Interval complete!</span>
            <button
              type="button"
              onClick={store.stopAlarm}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-error)',
                color: 'var(--m3-on-error)',
              }}
            >
              <BellOff size={16} />
              Stop alarm
            </button>
          </div>
        </div>
      )}

      {/* Always-On Display Overlay */}
      {aodMode && (
        <div
          onClick={() => setAodMode(false)}
          className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center cursor-pointer select-none"
        >
          <div className="text-7xl sm:text-8xl font-extrabold tabular-nums tracking-tight opacity-85">
            {store.timerState.timeStr}
          </div>
          <div className="mt-3 text-base font-semibold opacity-50">
            {store.currentTopic.name} · {store.timerState.currentFocusCount}/{store.timerState.totalFocusCount}
          </div>
          <div className="mt-8 text-xs opacity-35">Tap anywhere to exit Always-On Display</div>
        </div>
      )}

      {/* Minimized Floating Mini-Timer Mode */}
      {miniTimerMode && !aodMode && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface)' }}
        >
          <div
            className="w-full max-w-[300px] rounded-[28px] p-4 shadow-2xl border select-none backdrop-blur-xl transition-shadow"
            style={{
              backgroundColor: 'var(--m3-surface-container-low)',
              borderColor: 'var(--m3-outline-variant)',
              color: 'var(--m3-on-surface)',
              transform: `translate3d(${miniPos.x}px, ${miniPos.y}px, 0)`,
            }}
          >
            {/* Top drag handle & window actions */}
            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                dragStateRef.current = {
                  dragging: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: miniPos.x,
                  origY: miniPos.y,
                };
              }}
              onPointerMove={(e) => {
                if (!dragStateRef.current.dragging) return;
                setMiniPos({
                  x: dragStateRef.current.origX + (e.clientX - dragStateRef.current.startX),
                  y: dragStateRef.current.origY + (e.clientY - dragStateRef.current.startY),
                });
              }}
              onPointerUp={() => {
                dragStateRef.current.dragging = false;
              }}
              className="flex items-center justify-between gap-2 pb-2 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <GripHorizontal size={15} className="opacity-45 shrink-0" />
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: isFocus ? 'var(--m3-primary)' : 'var(--m3-tertiary)',
                  }}
                />
                <span className="text-xs font-bold truncate opacity-80">
                  {store.activeTask ? store.activeTask.title : store.currentTopic.name}
                </span>
              </div>
              <div
                className="flex items-center gap-1 shrink-0"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {window.self === window.top &&
                  typeof (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture !== 'undefined' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleOpenExternalPiP();
                    }}
                    title="Pop out floating window"
                    aria-label="Pop out floating window"
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
                  >
                    <PictureInPicture2 size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMiniTimerMode(false);
                  }}
                  title="Expand full app"
                  aria-label="Expand full app"
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            {/* Compact Countdown */}
            <div className="text-center py-2">
              <div className="text-5xl font-extrabold tabular-nums leading-none tracking-tight">
                {store.timerState.timeStr}
              </div>
              <div
                className="text-[11px] font-semibold mt-1.5 uppercase tracking-wider"
                style={{ color: isFocus ? 'var(--m3-primary)' : 'var(--m3-tertiary)' }}
              >
                {store.timerState.timerMode === 'FOCUS'
                  ? store.timerState.infiniteFocus
                    ? 'Infinite Focus'
                    : `Focus · ${store.timerState.currentFocusCount}/${store.timerState.totalFocusCount}`
                  : store.timerState.timerMode === 'SHORT_BREAK'
                    ? 'Short Break'
                    : 'Long Break'}
              </div>
            </div>

            {/* Subtle Progress Bar */}
            {!store.timerState.infiniteFocus && (
              <div
                className="w-full h-1.5 rounded-full overflow-hidden my-2.5"
                style={{
                  backgroundColor: isFocus
                    ? 'var(--m3-secondary-container)'
                    : 'var(--m3-tertiary-container)',
                }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, store.progress * 100))}%`,
                    backgroundColor: isFocus ? 'var(--m3-primary)' : 'var(--m3-tertiary)',
                  }}
                />
              </div>
            )}

            {/* Compact Controls */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={store.toggleTimer}
                aria-label={store.timerState.timerRunning ? 'Pause' : 'Play'}
                className="h-10 px-6 rounded-full flex items-center justify-center gap-1.5 text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-xs"
                style={{
                  backgroundColor: store.timerState.timerRunning
                    ? isFocus
                      ? 'var(--m3-primary)'
                      : 'var(--m3-tertiary)'
                    : 'var(--m3-primary-container)',
                  color: store.timerState.timerRunning
                    ? isFocus
                      ? 'var(--m3-on-primary)'
                      : 'var(--m3-on-tertiary)'
                    : 'var(--m3-on-primary-container)',
                }}
              >
                {store.timerState.timerRunning ? (
                  <>
                    <Pause size={15} fill="currentColor" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play size={15} fill="currentColor" />
                    Start
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={store.skipTimer}
                aria-label="Skip interval"
                title="Skip interval"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-surface-container-high)',
                  color: 'var(--m3-on-surface-variant)',
                }}
              >
                <SkipForward size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Topic Modal */}
      {topicModal.open && (
        <TopicModal
          initialTopic={topicModal.editing}
          existingNames={store.topics.map((t) => t.name)}
          tags={store.tags}
          onCreateTag={store.createTag}
          onClose={() => setTopicModal({ open: false })}
          onSave={(data, existingId) => {
            if (existingId !== undefined) {
              store.updateTopic({ ...data, id: existingId });
            } else {
              store.createTopic(data, Boolean(topicModal.setAsCurrent));
            }
          }}
        />
      )}

      {/* Task / Session / Break Celebration & Motivation Modal */}
      {celebration && (() => {
        const nextTodayTask =
          celebration.variant === 'task'
            ? store.tasks.find((t) => t.list === 'today')
            : undefined;
        return (
          <CelebrationModal
            title={celebration.title}
            subtitle={celebration.subtitle}
            variant={celebration.variant}
            focusSummary={celebration.focusSummary}
            nextTaskTitle={nextTodayTask?.title}
            onBlitzNextTask={
              nextTodayTask
                ? () => {
                    store.blitzTask(nextTodayTask.id);
                    setActiveTab('timer');
                  }
                : undefined
            }
            onClose={() => setCelebration(null)}
          />
        );
      })()}

      {/* Subtle PiP Notice Toast */}
      {pipNotice && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-xs font-semibold shadow-lg"
          style={{
            backgroundColor: 'var(--m3-surface-container-highest)',
            color: 'var(--m3-on-surface)',
          }}
        >
          {pipNotice}
        </div>
      )}
      </div>
    </div>
  );
}

export default App;

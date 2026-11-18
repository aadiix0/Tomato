import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TOPIC,
  DEFAULT_TOPIC_ID,
  type SettingsState,
  type Stat,
  type Task,
  type TaskListType,
  type TimerMode,
  type TimerState,
  type Topic,
} from '../types';
import {
  getDayQuarter,
  millisecondsToShortStr,
  millisecondsToStr,
  toLocalDateKey,
} from '../utils/time';
import { alarmPlayer } from '../utils/sound';

const STORAGE_KEYS = {
  TOPICS: 'tomato_topics_v2',
  CURRENT_TOPIC_ID: 'tomato_current_topic_id_v2',
  STATS: 'tomato_stats_v2',
  SETTINGS: 'tomato_settings_v2',
  TASKS: 'tomato_tasks_v2',
};

const SAVE_INTERVAL_MS = 60_000;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildIntervalState(
  prev: TimerState,
  topic: Topic,
  cycles: number,
  infiniteFocus: boolean
): TimerState {
  if (cycles % 2 === 0) {
    const totalTime = infiniteFocus ? Number.MAX_SAFE_INTEGER : topic.focusTime;
    const isLastBeforeLong = cycles === (topic.sessionLength - 1) * 2;
    return {
      ...prev,
      cycles,
      infiniteFocus,
      timerMode: 'FOCUS',
      totalTime,
      remainingTime: totalTime,
      timeStr: infiniteFocus ? millisecondsToStr(0) : millisecondsToStr(totalTime),
      nextTimerMode: isLastBeforeLong ? 'LONG_BREAK' : 'SHORT_BREAK',
      nextTimeStr: millisecondsToShortStr(
        isLastBeforeLong ? topic.longBreakTime : topic.shortBreakTime
      ),
      currentFocusCount: Math.floor(cycles / 2) + 1,
      totalFocusCount: topic.sessionLength,
    };
  } else {
    const isLong = cycles === topic.sessionLength * 2 - 1;
    const totalTime = isLong ? topic.longBreakTime : topic.shortBreakTime;
    return {
      ...prev,
      cycles,
      infiniteFocus,
      timerMode: isLong ? 'LONG_BREAK' : 'SHORT_BREAK',
      totalTime,
      remainingTime: totalTime,
      timeStr: millisecondsToStr(totalTime),
      nextTimerMode: 'FOCUS',
      nextTimeStr: infiniteFocus ? 'Infinite' : millisecondsToShortStr(topic.focusTime),
      totalFocusCount: topic.sessionLength,
    };
  }
}

interface ResetSnapshot {
  timerState: TimerState;
  startTime: number;
  pauseTime: number;
  pauseDuration: number;
  lastSavedDuration: number;
}

export function useTomatoStore() {
  const [topics, setTopics] = useState<Topic[]>(() => {
    const loaded = loadJson<Topic[]>(STORAGE_KEYS.TOPICS, [DEFAULT_TOPIC]);
    return loaded.length > 0 ? loaded : [DEFAULT_TOPIC];
  });

  const [currentTopicId, setCurrentTopicId] = useState<number>(() =>
    loadJson<number>(STORAGE_KEYS.CURRENT_TOPIC_ID, DEFAULT_TOPIC_ID)
  );

  const [stats, setStats] = useState<Stat[]>(() =>
    loadJson<Stat[]>(STORAGE_KEYS.STATS, [])
  );

  const [settings, setSettings] = useState<SettingsState>(() => ({
    ...DEFAULT_SETTINGS,
    ...loadJson<Partial<SettingsState>>(STORAGE_KEYS.SETTINGS, {}),
  }));

  const [tasks, setTasks] = useState<Task[]>(() =>
    loadJson<Task[]>(STORAGE_KEYS.TASKS, [])
  );

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  const activeTaskIdRef = useRef<string | null>(activeTaskId);
  activeTaskIdRef.current = activeTaskId;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  const currentTopic = useMemo(
    () => topics.find((t) => t.id === currentTopicId) ?? topics[0] ?? DEFAULT_TOPIC,
    [topics, currentTopicId]
  );

  const [timerState, setTimerState] = useState<TimerState>(() =>
    buildIntervalState(
      {
        timerMode: 'FOCUS',
        timeStr: millisecondsToStr(currentTopic.focusTime),
        totalTime: currentTopic.focusTime,
        remainingTime: currentTopic.focusTime,
        timerRunning: false,
        nextTimerMode: currentTopic.sessionLength > 1 ? 'SHORT_BREAK' : 'LONG_BREAK',
        nextTimeStr: millisecondsToShortStr(
          currentTopic.sessionLength > 1
            ? currentTopic.shortBreakTime
            : currentTopic.longBreakTime
        ),
        showBrandTitle: true,
        currentFocusCount: 1,
        totalFocusCount: currentTopic.sessionLength,
        alarmRinging: false,
        infiniteFocus: false,
        cycles: 0,
      },
      currentTopic,
      0,
      false
    )
  );

  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const pauseDurationRef = useRef<number>(0);
  const lastSavedDurationRef = useRef<number>(0);
  const resetSnapshotRef = useRef<ResetSnapshot | null>(null);
  const timerStateRef = useRef(timerState);
  timerStateRef.current = timerState;
  const currentTopicRef = useRef(currentTopic);
  currentTopicRef.current = currentTopic;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
  }, [topics]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TOPIC_ID, JSON.stringify(currentTopicId));
  }, [currentTopicId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const sessionActive = useMemo(() => {
    const expectedStart = timerState.infiniteFocus
      ? millisecondsToStr(0)
      : millisecondsToStr(timerState.totalTime);
    return (
      timerState.timerRunning ||
      timerState.timerMode !== 'FOCUS' ||
      timerState.currentFocusCount !== 1 ||
      timerState.timeStr !== expectedStart
    );
  }, [timerState]);

  const addStatTime = useCallback(
    (topicId: number, mode: TimerMode, durationMs: number) => {
      if (durationMs <= 0) return;
      const dateKey = toLocalDateKey();
      const quarter = getDayQuarter();

      setStats((prev) => {
        const idx = prev.findIndex((s) => s.date === dateKey && s.topicId === topicId);
        if (idx === -1) {
          const entry: Stat = {
            date: dateKey,
            topicId,
            focusTimeQ1: mode === 'FOCUS' && quarter === 'Q1' ? durationMs : 0,
            focusTimeQ2: mode === 'FOCUS' && quarter === 'Q2' ? durationMs : 0,
            focusTimeQ3: mode === 'FOCUS' && quarter === 'Q3' ? durationMs : 0,
            focusTimeQ4: mode === 'FOCUS' && quarter === 'Q4' ? durationMs : 0,
            breakTime: mode !== 'FOCUS' ? durationMs : 0,
          };
          return [...prev, entry];
        }
        const existing = prev[idx];
        const updated: Stat = {
          ...existing,
          focusTimeQ1:
            existing.focusTimeQ1 + (mode === 'FOCUS' && quarter === 'Q1' ? durationMs : 0),
          focusTimeQ2:
            existing.focusTimeQ2 + (mode === 'FOCUS' && quarter === 'Q2' ? durationMs : 0),
          focusTimeQ3:
            existing.focusTimeQ3 + (mode === 'FOCUS' && quarter === 'Q3' ? durationMs : 0),
          focusTimeQ4:
            existing.focusTimeQ4 + (mode === 'FOCUS' && quarter === 'Q4' ? durationMs : 0),
          breakTime: existing.breakTime + (mode !== 'FOCUS' ? durationMs : 0),
        };
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    },
    []
  );

  const getElapsedInInterval = useCallback(() => {
    if (startTimeRef.current === 0) return 0;
    const now = pauseTimeRef.current !== 0 ? pauseTimeRef.current : Date.now();
    return Math.max(0, now - startTimeRef.current - pauseDurationRef.current);
  }, []);

  const flushElapsedTime = useCallback(() => {
    const state = timerStateRef.current;
    const topic = currentTopicRef.current;
    const intervalDuration =
      state.timerMode === 'FOCUS'
        ? state.infiniteFocus
          ? Number.MAX_SAFE_INTEGER
          : topic.focusTime
        : state.timerMode === 'SHORT_BREAK'
          ? topic.shortBreakTime
          : topic.longBreakTime;

    const elapsed = Math.min(getElapsedInInterval(), intervalDuration);
    const delta = Math.max(0, elapsed - lastSavedDurationRef.current);
    if (delta > 0) {
      addStatTime(topic.id, state.timerMode, delta);
      if (state.timerMode === 'FOCUS' && activeTaskIdRef.current) {
        const tid = activeTaskIdRef.current;
        setTasks((prev) =>
          prev.map((t) => (t.id === tid ? { ...t, actualMs: t.actualMs + delta } : t))
        );
      }
    }
    lastSavedDurationRef.current = elapsed;
  }, [addStatTime, getElapsedInInterval]);

  const advanceInterval = useCallback(
    (startImmediately: boolean, ringAlarm: boolean) => {
      flushElapsedTime();
      lastSavedDurationRef.current = 0;
      pauseTimeRef.current = 0;
      pauseDurationRef.current = 0;
      startTimeRef.current = startImmediately ? Date.now() : 0;

      const topic = currentTopicRef.current;
      const prev = timerStateRef.current;
      const nextCycles = (prev.cycles + 1) % (topic.sessionLength * 2);

      if (ringAlarm && settingsRef.current.alarmEnabled) {
        alarmPlayer.start(settingsRef.current.vibrateEnabled);
      }

      setTimerState((curr) => ({
        ...buildIntervalState(curr, topic, nextCycles, curr.infiniteFocus),
        timerRunning: startImmediately,
        alarmRinging: ringAlarm && settingsRef.current.alarmEnabled,
        showBrandTitle: false,
      }));
    },
    [flushElapsedTime]
  );

  useEffect(() => {
    if (!timerState.timerRunning) return;

    const id = window.setInterval(() => {
      const state = timerStateRef.current;
      const topic = currentTopicRef.current;
      const elapsed = getElapsedInInterval();

      const intervalDuration =
        state.timerMode === 'FOCUS'
          ? state.infiniteFocus
            ? Number.MAX_SAFE_INTEGER
            : topic.focusTime
          : state.timerMode === 'SHORT_BREAK'
            ? topic.shortBreakTime
            : topic.longBreakTime;

      const remaining = intervalDuration - elapsed;

      if (remaining <= 0 && !(state.infiniteFocus && state.timerMode === 'FOCUS')) {
        advanceInterval(topic.autostartNextSession, true);
        return;
      }

      if (elapsed - lastSavedDurationRef.current >= SAVE_INTERVAL_MS) {
        flushElapsedTime();
      }

      const displayStr =
        state.infiniteFocus && state.timerMode === 'FOCUS'
          ? millisecondsToStr(elapsed)
          : millisecondsToStr(remaining);

      setTimerState((curr) => ({
        ...curr,
        remainingTime: remaining,
        timeStr: displayStr,
      }));
    }, 200);

    return () => window.clearInterval(id);
  }, [timerState.timerRunning, advanceInterval, flushElapsedTime, getElapsedInInterval]);

  const toggleTimer = useCallback(() => {
    const state = timerStateRef.current;
    if (state.alarmRinging) {
      alarmPlayer.stop();
    }
    if (state.timerRunning) {
      pauseTimeRef.current = Date.now();
      setTimerState((curr) => ({ ...curr, timerRunning: false, alarmRinging: false }));
    } else {
      if (startTimeRef.current === 0) {
        startTimeRef.current = Date.now();
        pauseTimeRef.current = 0;
        pauseDurationRef.current = 0;
      } else if (pauseTimeRef.current !== 0) {
        pauseDurationRef.current += Math.max(0, Date.now() - pauseTimeRef.current);
        pauseTimeRef.current = 0;
      }
      setTimerState((curr) => ({
        ...curr,
        timerRunning: true,
        showBrandTitle: false,
        alarmRinging: false,
      }));
    }
  }, []);

  const skipTimer = useCallback(() => {
    alarmPlayer.stop();
    advanceInterval(timerStateRef.current.timerRunning, false);
  }, [advanceInterval]);

  const resetTimer = useCallback(() => {
    alarmPlayer.stop();
    const state = timerStateRef.current;
    if (state.timerRunning) {
      pauseTimeRef.current = Date.now();
    }
    flushElapsedTime();

    resetSnapshotRef.current = {
      timerState: { ...state, timerRunning: false, alarmRinging: false },
      startTime: startTimeRef.current,
      pauseTime: pauseTimeRef.current,
      pauseDuration: pauseDurationRef.current,
      lastSavedDuration: lastSavedDurationRef.current,
    };

    startTimeRef.current = 0;
    pauseTimeRef.current = 0;
    pauseDurationRef.current = 0;
    lastSavedDurationRef.current = 0;

    const topic = currentTopicRef.current;
    setTimerState((curr) => ({
      ...buildIntervalState(curr, topic, 0, curr.infiniteFocus),
      timerRunning: false,
      alarmRinging: false,
      showBrandTitle: true,
    }));
  }, [flushElapsedTime]);

  const undoReset = useCallback(() => {
    const snap = resetSnapshotRef.current;
    if (!snap) return;
    startTimeRef.current = snap.startTime;
    pauseTimeRef.current = snap.pauseTime;
    pauseDurationRef.current = snap.pauseDuration;
    lastSavedDurationRef.current = snap.lastSavedDuration;
    setTimerState(snap.timerState);
    resetSnapshotRef.current = null;
  }, []);

  const stopAlarm = useCallback(() => {
    alarmPlayer.stop();
    setTimerState((curr) => ({ ...curr, alarmRinging: false }));
  }, []);

  const toggleInfiniteFocus = useCallback(() => {
    if (timerStateRef.current.timerRunning) return false;
    const nextInf = !timerStateRef.current.infiniteFocus;
    const topic = currentTopicRef.current;
    setTimerState((curr) => buildIntervalState(curr, topic, curr.cycles, nextInf));
    return true;
  }, []);

  const selectTopic = useCallback(
    (topicId: number) => {
      const target = topics.find((t) => t.id === topicId);
      if (!target) return;
      setCurrentTopicId(target.id);
      startTimeRef.current = 0;
      pauseTimeRef.current = 0;
      pauseDurationRef.current = 0;
      lastSavedDurationRef.current = 0;
      setTimerState((curr) => ({
        ...buildIntervalState(curr, target, 0, curr.infiniteFocus),
        timerRunning: false,
        showBrandTitle: true,
      }));
    },
    [topics]
  );

  const createTopic = useCallback(
    (data: Omit<Topic, 'id'>, setAsCurrent = false) => {
      const nextId = topics.reduce((max, t) => Math.max(max, t.id), 0) + 1;
      const newTopic: Topic = { ...data, id: nextId };
      setTopics((prev) => [...prev, newTopic]);
      if (setAsCurrent) {
        setCurrentTopicId(newTopic.id);
        setTimerState((curr) => ({
          ...buildIntervalState(curr, newTopic, 0, curr.infiniteFocus),
          timerRunning: false,
          showBrandTitle: true,
        }));
      }
      return newTopic;
    },
    [topics]
  );

  const updateTopic = useCallback((updated: Topic) => {
    setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (updated.id === currentTopicRef.current.id && !timerStateRef.current.timerRunning) {
      setTimerState((curr) => buildIntervalState(curr, updated, curr.cycles, curr.infiniteFocus));
    }
  }, []);

  const deleteTopic = useCallback(
    (topicId: number) => {
      if (topicId === DEFAULT_TOPIC_ID) return;
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
      setStats((prev) => prev.filter((s) => s.topicId !== topicId));
      if (currentTopicId === topicId) {
        selectTopic(DEFAULT_TOPIC_ID);
      }
    },
    [currentTopicId, selectTopic]
  );

  const updateSettings = useCallback((patch: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const createTask = useCallback(
    (title: string, estimatedMinutes: number, topicId: number, list: TaskListType) => {
      const newTask: Task = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        topicId,
        list,
        estimatedMinutes,
        actualMs: 0,
        subtasks: [],
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
    },
    []
  );

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setActiveTaskId((curr) => (curr === taskId ? null : curr));
  }, []);

  const moveTask = useCallback((taskId: string, list: TaskListType) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, list, completedAt: list === 'done' ? new Date().toISOString() : undefined }
          : t
      )
    );
  }, []);

  const completeTask = useCallback(
    (taskId: string): Task | null => {
      if (activeTaskIdRef.current === taskId) {
        flushElapsedTime();
        setActiveTaskId(null);
      }
      let completed: Task | null = null;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          completed = { ...t, list: 'done', completedAt: new Date().toISOString() };
          return completed;
        })
      );
      return completed;
    },
    [flushElapsedTime]
  );

  const addSubtask = useCallback((taskId: string, title: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: [
                ...t.subtasks,
                { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, done: false },
              ],
            }
          : t
      )
    );
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
            }
          : t
      )
    );
  }, []);

  const blitzTask = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return;
      setActiveTaskId(target.id);
      if (target.list === 'backlog') {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, list: 'today' } : t)));
      }
      const targetTopic = topics.find((t) => t.id === target.topicId) ?? currentTopicRef.current;
      setCurrentTopicId(targetTopic.id);
      const focusMs = Math.max(1, target.estimatedMinutes) * 60 * 1000;
      startTimeRef.current = Date.now();
      pauseTimeRef.current = 0;
      pauseDurationRef.current = 0;
      lastSavedDurationRef.current = 0;
      alarmPlayer.stop();
      setTimerState((curr) => ({
        ...buildIntervalState(curr, { ...targetTopic, focusTime: focusMs }, 0, false),
        timerRunning: true,
        alarmRinging: false,
        showBrandTitle: false,
      }));
    },
    [tasks, topics]
  );

  const eraseAllData = useCallback(() => {
    alarmPlayer.stop();
    setTopics([DEFAULT_TOPIC]);
    setCurrentTopicId(DEFAULT_TOPIC_ID);
    setStats([]);
    setTasks([]);
    setActiveTaskId(null);
    setSettings(DEFAULT_SETTINGS);
    startTimeRef.current = 0;
    pauseTimeRef.current = 0;
    pauseDurationRef.current = 0;
    lastSavedDurationRef.current = 0;
    setTimerState((curr) => ({
      ...buildIntervalState(curr, DEFAULT_TOPIC, 0, false),
      timerRunning: false,
      alarmRinging: false,
      showBrandTitle: true,
    }));
  }, []);

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        topics,
        currentTopicId,
        stats,
        tasks,
        settings,
      },
      null,
      2
    );
  }, [topics, currentTopicId, stats, tasks, settings]);

  const importBackupJson = useCallback((raw: string): boolean => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.topics) || !Array.isArray(parsed.stats)) {
        return false;
      }
      const restoredTopics: Topic[] =
        parsed.topics.length > 0 ? parsed.topics : [DEFAULT_TOPIC];
      setTopics(restoredTopics);
      setStats(parsed.stats);
      if (Array.isArray(parsed.tasks)) {
        setTasks(parsed.tasks);
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      }
      const restoredId =
        typeof parsed.currentTopicId === 'number' &&
        restoredTopics.some((t) => t.id === parsed.currentTopicId)
          ? parsed.currentTopicId
          : restoredTopics[0].id;
      setCurrentTopicId(restoredId);
      const activeTopic = restoredTopics.find((t) => t.id === restoredId) ?? DEFAULT_TOPIC;
      setTimerState((curr) => ({
        ...buildIntervalState(curr, activeTopic, 0, false),
        timerRunning: false,
        showBrandTitle: true,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const progress = useMemo(() => {
    if (timerState.infiniteFocus && timerState.timerMode === 'FOCUS') return 1;
    if (timerState.totalTime <= 0) return 0;
    return Math.min(1, Math.max(0, 1 - timerState.remainingTime / timerState.totalTime));
  }, [timerState]);

  return {
    topics,
    currentTopic,
    stats,
    tasks,
    activeTaskId,
    activeTask,
    settings,
    timerState,
    sessionActive,
    progress,
    toggleTimer,
    skipTimer,
    resetTimer,
    undoReset,
    stopAlarm,
    toggleInfiniteFocus,
    selectTopic,
    createTopic,
    updateTopic,
    deleteTopic,
    createTask,
    deleteTask,
    moveTask,
    completeTask,
    addSubtask,
    toggleSubtask,
    blitzTask,
    updateSettings,
    eraseAllData,
    exportBackupJson,
    importBackupJson,
  };
}

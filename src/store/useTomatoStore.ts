import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TOPIC,
  DEFAULT_TOPIC_ID,
  type SettingsState,
  type Stat,
  type TagItem,
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
import {
  loadInitialFromLocalStorage,
  loadPersistedState,
  persistFullState,
  type PersistedBundle,
} from '../services/localPersistence';

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
  const initialDataRef = useRef<PersistedBundle | null>(null);
  if (!initialDataRef.current) {
    initialDataRef.current = loadInitialFromLocalStorage();
  }

  const [topics, setTopics] = useState<Topic[]>(initialDataRef.current.topics);
  const [currentTopicId, setCurrentTopicId] = useState<number>(initialDataRef.current.currentTopicId);
  const [stats, setStats] = useState<Stat[]>(initialDataRef.current.stats);
  const [settings, setSettings] = useState<SettingsState>(initialDataRef.current.settings);
  const [tasks, setTasks] = useState<Task[]>(initialDataRef.current.tasks);
  const [tags, setTags] = useState<TagItem[]>(initialDataRef.current.tags ?? []);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const lastModifiedRef = useRef<number>(initialDataRef.current.lastModified);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  const activeTaskIdRef = useRef<string | null>(activeTaskId);
  activeTaskIdRef.current = activeTaskId;
  const activeTagIdsRef = useRef<string[]>(activeTagIds);
  activeTagIdsRef.current = activeTagIds;

  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate from Electron PC filesystem or IndexedDB if localStorage was missing or behind
  useEffect(() => {
    let mounted = true;
    void loadPersistedState()
      .then((persisted) => {
        if (!mounted || !persisted) return;
        const currentCount = topics.length;
        const persistedCount = Array.isArray(persisted.topics) ? persisted.topics.length : 0;
        const persistedTime = persisted.lastModified || 0;
        const shouldHydrate =
          lastModifiedRef.current === 0 ||
          (currentCount <= 1 && persistedCount > 1) ||
          persistedTime > lastModifiedRef.current;

        if (shouldHydrate) {
          const restoredTopics =
            Array.isArray(persisted.topics) && persisted.topics.length > 0
              ? persisted.topics
              : [DEFAULT_TOPIC];
          const restoredTopicId =
            typeof persisted.currentTopicId === 'number' &&
            restoredTopics.some((t) => t.id === persisted.currentTopicId)
              ? persisted.currentTopicId
              : restoredTopics[0].id;
          const activeTopic =
            restoredTopics.find((t) => t.id === restoredTopicId) ?? restoredTopics[0];

          setTopics(restoredTopics);
          setStats(Array.isArray(persisted.stats) ? persisted.stats : []);
          setTasks(Array.isArray(persisted.tasks) ? persisted.tasks : []);
          setTags(Array.isArray(persisted.tags) ? persisted.tags : []);
          if (persisted.settings) {
            setSettings((prev) => ({ ...prev, ...persisted.settings }));
          }
          setCurrentTopicId(restoredTopicId);
          setTimerState((curr) =>
            curr.timerRunning
              ? curr
              : {
                  ...buildIntervalState(curr, activeTopic, 0, curr.infiniteFocus),
                  timerRunning: false,
                  showBrandTitle: true,
                }
          );
          lastModifiedRef.current = persistedTime || Date.now();
        }
      })
      .finally(() => {
        if (mounted) {
          setIsHydrated(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

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

  // Multi-tier persistence: localStorage + IndexedDB + Electron PC hard drive
  useEffect(() => {
    if (!isHydrated) return;
    const now = Date.now();
    lastModifiedRef.current = now;
    persistFullState({
      version: 2,
      lastModified: now,
      topics,
      currentTopicId,
      stats,
      tasks,
      tags,
      settings,
    });
  }, [isHydrated, topics, currentTopicId, stats, tasks, tags, settings]);

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
    (topicId: number, mode: TimerMode, durationMs: number, tagIds: string[] = []) => {
      if (durationMs <= 0) return;
      const dateKey = toLocalDateKey();
      const quarter = getDayQuarter();

      setStats((prev) => {
        const idx = prev.findIndex((s) => s.date === dateKey && s.topicId === topicId);
        if (idx === -1) {
          const tagMs: Record<string, number> | undefined =
            mode === 'FOCUS' && tagIds.length > 0
              ? Object.fromEntries(tagIds.map((id) => [id, durationMs]))
              : undefined;
          const entry: Stat = {
            date: dateKey,
            topicId,
            focusTimeQ1: mode === 'FOCUS' && quarter === 'Q1' ? durationMs : 0,
            focusTimeQ2: mode === 'FOCUS' && quarter === 'Q2' ? durationMs : 0,
            focusTimeQ3: mode === 'FOCUS' && quarter === 'Q3' ? durationMs : 0,
            focusTimeQ4: mode === 'FOCUS' && quarter === 'Q4' ? durationMs : 0,
            breakTime: mode !== 'FOCUS' ? durationMs : 0,
            ...(tagMs ? { tagMs } : {}),
          };
          return [...prev, entry];
        }
        const existing = prev[idx];
        let nextTagMs = existing.tagMs;
        if (mode === 'FOCUS' && tagIds.length > 0) {
          nextTagMs = { ...(existing.tagMs ?? {}) };
          for (const tid of tagIds) {
            nextTagMs[tid] = (nextTagMs[tid] ?? 0) + durationMs;
          }
        }
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
          ...(nextTagMs ? { tagMs: nextTagMs } : {}),
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
      addStatTime(topic.id, state.timerMode, delta, activeTagIdsRef.current);
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
      setActiveTagIds(target.tagIds ?? []);
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
        setActiveTagIds(newTopic.tagIds ?? []);
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

  const createTag = useCallback((name: string, color: string): TagItem => {
    const trimmed = name.trim().replace(/^#+/, '');
    const newTag: TagItem = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      color,
    };
    setTags((prev) => {
      const existing = prev.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return prev;
      return [...prev, newTag];
    });
    return newTag;
  }, []);

  const updateTag = useCallback((updated: TagItem) => {
    setTags((prev) =>
      prev.map((t) =>
        t.id === updated.id
          ? { ...updated, name: updated.name.trim().replace(/^#+/, '') }
          : t
      )
    );
  }, []);

  const deleteTag = useCallback((tagId: string) => {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setActiveTagIds((prev) => prev.filter((id) => id !== tagId));
    setTopics((prev) =>
      prev.map((topic) =>
        topic.tagIds?.includes(tagId)
          ? { ...topic, tagIds: topic.tagIds.filter((id) => id !== tagId) }
          : topic
      )
    );
    setTasks((prev) =>
      prev.map((task) =>
        task.tagIds?.includes(tagId)
          ? { ...task, tagIds: task.tagIds.filter((id) => id !== tagId) }
          : task
      )
    );
  }, []);

  const toggleActiveTag = useCallback((tagId: string) => {
    setActiveTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const createTask = useCallback(
    (
      title: string,
      estimatedMinutes: number,
      topicId: number,
      list: TaskListType,
      tagIds: string[] = []
    ) => {
      const newTask: Task = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        topicId,
        tagIds,
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

  const updateTaskTags = useCallback((taskId: string, tagIds: string[]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, tagIds } : t)));
  }, []);

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
      if (target.tagIds && target.tagIds.length > 0) {
        setActiveTagIds(target.tagIds);
      }
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
    setTags([]);
    setActiveTagIds([]);
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

  const isPristine = useMemo(() => {
    return (
      topics.length <= 1 &&
      (topics[0]?.id === DEFAULT_TOPIC_ID || !topics[0]) &&
      stats.length === 0 &&
      tasks.length === 0
    );
  }, [topics, stats, tasks]);

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        lastModified: lastModifiedRef.current || Date.now(),
        topics,
        currentTopicId,
        stats,
        tasks,
        tags,
        settings,
      },
      null,
      2
    );
  }, [topics, currentTopicId, stats, tasks, tags, settings]);

  const importBackupJson = useCallback((raw: string): boolean => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.topics) || !Array.isArray(parsed.stats)) {
        return false;
      }
      const restoredTopics: Topic[] =
        parsed.topics.length > 0 ? parsed.topics : [DEFAULT_TOPIC];
      const restoredId =
        typeof parsed.currentTopicId === 'number' &&
        restoredTopics.some((t) => t.id === parsed.currentTopicId)
          ? parsed.currentTopicId
          : restoredTopics[0].id;
      const restoredStats = Array.isArray(parsed.stats) ? parsed.stats : [];
      const restoredTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      const restoredTags = Array.isArray(parsed.tags) ? parsed.tags : [];
      const restoredSettings = {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
      };
      const restoredModified =
        typeof parsed.lastModified === 'number'
          ? parsed.lastModified
          : parsed.exportedAt
            ? new Date(parsed.exportedAt).getTime()
            : Date.now();

      setTopics(restoredTopics);
      setStats(restoredStats);
      setTasks(restoredTasks);
      setTags(restoredTags);
      setSettings(restoredSettings);
      setCurrentTopicId(restoredId);
      lastModifiedRef.current = restoredModified;

      persistFullState({
        version: 2,
        lastModified: restoredModified,
        topics: restoredTopics,
        currentTopicId: restoredId,
        stats: restoredStats,
        tasks: restoredTasks,
        tags: restoredTags,
        settings: restoredSettings,
      });

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

  const todayFocusMs = useMemo(() => {
    const todayKey = toLocalDateKey();
    const savedToday = stats
      .filter((s) => s.date === todayKey)
      .reduce(
        (sum, s) => sum + s.focusTimeQ1 + s.focusTimeQ2 + s.focusTimeQ3 + s.focusTimeQ4,
        0
      );

    let unsavedFocusMs = 0;
    if (timerState.timerMode === 'FOCUS' && startTimeRef.current !== 0) {
      const currentElapsed = getElapsedInInterval();
      unsavedFocusMs = Math.max(0, currentElapsed - lastSavedDurationRef.current);
    }
    return savedToday + unsavedFocusMs;
  }, [stats, timerState.timerMode, timerState.remainingTime, timerState.timeStr, getElapsedInInterval]);

  return {
    topics,
    currentTopic,
    stats,
    tasks,
    tags,
    activeTagIds,
    activeTaskId,
    activeTask,
    settings,
    timerState,
    sessionActive,
    progress,
    todayFocusMs,
    lastModified: lastModifiedRef.current,
    isPristine,
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
    createTag,
    updateTag,
    deleteTag,
    toggleActiveTag,
    setActiveTagIds,
    createTask,
    updateTaskTags,
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

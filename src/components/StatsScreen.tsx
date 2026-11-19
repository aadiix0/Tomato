import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  Flame,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Stat, StatsSubScreen, Task, Topic } from '../types';
import {
  getLastNDates,
  millisecondsToHoursMinutes,
  toLocalDateKey,
  totalFocusOfStat,
} from '../utils/time';
import { TopicShapeIcon } from './TopicShapeIcon';

interface StatsScreenProps {
  stats: Stat[];
  topics: Topic[];
  tasks: Task[];
  focusGoal: number;
  subScreen: StatsSubScreen;
  onNavigate: (sub: StatsSubScreen) => void;
  hasCustomBg?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  0: 'Sun',
};
const DOW_FULL: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  0: 'Sunday',
};

export const StatsScreen: React.FC<StatsScreenProps> = ({
  stats,
  topics,
  tasks,
  focusGoal,
  subScreen,
  onNavigate,
  hasCustomBg = false,
}) => {
  const todayKey = toLocalDateKey();
  // Empty array means "All topics"
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ label: string; ms: number } | null>(null);
  const [distributionView, setDistributionView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [weeklyTimeFrame, setWeeklyTimeFrame] = useState<'all' | '12w' | '4w'>('all');
  const [weeklyMetric, setWeeklyMetric] = useState<'avg' | 'total'>('avg');
  const [selectedTrendDow, setSelectedTrendDow] = useState<number | null>(null);
  const [trendSortBy, setTrendSortBy] = useState<'day' | 'productivity'>('day');

  const toggleTopicFilter = (topicId: number) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  const filteredStats = useMemo(() => {
    if (selectedTopicIds.length === 0) return stats;
    const set = new Set(selectedTopicIds);
    return stats.filter((s) => set.has(s.topicId));
  }, [stats, selectedTopicIds]);

  const filteredTasks = useMemo(() => {
    if (selectedTopicIds.length === 0) return tasks;
    const set = new Set(selectedTopicIds);
    return tasks.filter((t) => set.has(t.topicId));
  }, [tasks, selectedTopicIds]);

  const statsByDate = useMemo(() => {
    const map = new Map<string, { focus: number; breakTime: number; q1: number; q2: number; q3: number; q4: number }>();
    for (const s of filteredStats) {
      const cur = map.get(s.date) ?? { focus: 0, breakTime: 0, q1: 0, q2: 0, q3: 0, q4: 0 };
      cur.focus += totalFocusOfStat(s);
      cur.breakTime += s.breakTime;
      cur.q1 += s.focusTimeQ1;
      cur.q2 += s.focusTimeQ2;
      cur.q3 += s.focusTimeQ3;
      cur.q4 += s.focusTimeQ4;
      map.set(s.date, cur);
    }
    return map;
  }, [filteredStats]);

  const todaySummary = statsByDate.get(todayKey) ?? {
    focus: 0,
    breakTime: 0,
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
  };

  const lastWeekData = useMemo(() => {
    return getLastNDates(7).map((d) => {
      const key = toLocalDateKey(d);
      const entry = statsByDate.get(key);
      return {
        label: WEEKDAYS[d.getDay()],
        date: key,
        minutes: Math.round((entry?.focus ?? 0) / 60000),
        ms: entry?.focus ?? 0,
        q1: entry?.q1 ?? 0,
        q2: entry?.q2 ?? 0,
        q3: entry?.q3 ?? 0,
        q4: entry?.q4 ?? 0,
      };
    });
  }, [statsByDate]);

  const lastMonthData = useMemo(() => {
    return getLastNDates(30).map((d) => {
      const key = toLocalDateKey(d);
      const entry = statsByDate.get(key);
      return {
        label: `${d.getDate()}`,
        date: key,
        minutes: Math.round((entry?.focus ?? 0) / 60000),
        ms: entry?.focus ?? 0,
        q1: entry?.q1 ?? 0,
        q2: entry?.q2 ?? 0,
        q3: entry?.q3 ?? 0,
        q4: entry?.q4 ?? 0,
      };
    });
  }, [statsByDate]);

  const lastYearData = useMemo(() => {
    const today = new Date();
    const buckets: { label: string; key: string; ms: number; minutes: number; q1: number; q2: number; q3: number; q4: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      buckets.push({ label: MONTHS[d.getMonth()], key: ym, ms: 0, minutes: 0, q1: 0, q2: 0, q3: 0, q4: 0 });
    }
    for (const [dateKey, val] of statsByDate.entries()) {
      const ym = dateKey.slice(0, 7);
      const bucket = buckets.find((b) => b.key === ym);
      if (bucket) {
        bucket.ms += val.focus;
        bucket.q1 += val.q1;
        bucket.q2 += val.q2;
        bucket.q3 += val.q3;
        bucket.q4 += val.q4;
      }
    }
    buckets.forEach((b) => {
      b.minutes = Math.round(b.ms / 60000);
    });
    return buckets;
  }, [statsByDate]);

  const avgMs = (arr: { ms: number }[], divisor: number) =>
    Math.round(arr.reduce((sum, x) => sum + x.ms, 0) / Math.max(1, divisor));

  const lastWeekAvg = avgMs(lastWeekData, 7);
  const lastMonthAvg = avgMs(lastMonthData, 30);
  const lastYearAvg = avgMs(lastYearData, 365);

  const focusDistribution = useMemo(() => {
    const dailyData = [
      {
        label: 'Morning',
        fullLabel: 'Morning (00:00–12:00)',
        minutes: Math.round(todaySummary.q1 / 60000),
        ms: todaySummary.q1,
        color: 'var(--m3-primary)',
      },
      {
        label: 'Afternoon',
        fullLabel: 'Afternoon (12:00–16:00)',
        minutes: Math.round(todaySummary.q2 / 60000),
        ms: todaySummary.q2,
        color: 'var(--m3-tertiary)',
      },
      {
        label: 'Evening',
        fullLabel: 'Evening (16:00–20:00)',
        minutes: Math.round(todaySummary.q3 / 60000),
        ms: todaySummary.q3,
        color: 'var(--m3-secondary)',
      },
      {
        label: 'Night',
        fullLabel: 'Night (20:00–00:00)',
        minutes: Math.round(todaySummary.q4 / 60000),
        ms: todaySummary.q4,
        color: 'var(--m3-outline)',
      },
    ];

    const dailyPeak = dailyData.reduce(
      (best, item) => (item.ms > best.ms ? item : best),
      dailyData[0]
    );

    const weeklyTotal = lastWeekData.reduce((sum, d) => sum + d.ms, 0);
    const weeklyPeak = lastWeekData.reduce(
      (best, item) => (item.ms > best.ms ? item : best),
      lastWeekData[0]
    );

    const monthlyTotal = lastMonthData.reduce((sum, d) => sum + d.ms, 0);
    const monthlyPeak = lastMonthData.reduce(
      (best, item) => (item.ms > best.ms ? item : best),
      lastMonthData[0]
    );
    const monthlyActiveDays = lastMonthData.filter((d) => d.ms > 0).length;

    return {
      dailyData,
      dailyPeak: dailyPeak && dailyPeak.ms > 0 ? dailyPeak : null,
      weeklyTotal,
      weeklyPeak: weeklyPeak && weeklyPeak.ms > 0 ? weeklyPeak : null,
      monthlyTotal,
      monthlyPeak: monthlyPeak && monthlyPeak.ms > 0 ? monthlyPeak : null,
      monthlyActiveDays,
    };
  }, [todaySummary, lastWeekData, lastMonthData]);

  const lifetimeTotal = useMemo(
    () => filteredStats.reduce((sum, s) => sum + totalFocusOfStat(s), 0),
    [filteredStats]
  );

  const completedTasksStats = useMemo(() => {
    const done = filteredTasks.filter((t) => t.list === 'done');
    const estMs = done.reduce((sum, t) => sum + t.estimatedMinutes * 60000, 0);
    const actualMs = done.reduce((sum, t) => sum + t.actualMs, 0);
    return { count: done.length, estMs, actualMs };
  }, [filteredTasks]);

  const streakAndHeatmap = useMemo(() => {
    // Build 16 full calendar weeks aligned Sunday -> Saturday ending on the current week's Saturday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()));

    const numWeeks = 16;
    const totalDays = numWeeks * 7;
    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - (totalDays - 1));

    const weeks: {
      monthLabel: string;
      days: { key: string; label: string; ms: number; mins: number; level: number; isFuture: boolean }[];
    }[] = [];

    let activeDaysCount = 0;
    let lastMonth = -1;

    for (let w = 0; w < numWeeks; w++) {
      const weekDays: { key: string; label: string; ms: number; mins: number; level: number; isFuture: boolean }[] = [];
      let monthLabel = '';
      for (let d = 0; d < 7; d++) {
        const cur = new Date(startDate);
        cur.setDate(startDate.getDate() + w * 7 + d);
        const key = toLocalDateKey(cur);
        const isFuture = cur.getTime() > today.getTime();
        const ms = isFuture ? 0 : (statsByDate.get(key)?.focus ?? 0);
        const mins = Math.round(ms / 60000);
        if (ms > 0) activeDaysCount++;
        const level = mins === 0 ? 0 : mins < 25 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
        if (d === 0 && cur.getMonth() !== lastMonth) {
          monthLabel = MONTHS[cur.getMonth()];
          lastMonth = cur.getMonth();
        }
        weekDays.push({
          key,
          label: `${WEEKDAYS[cur.getDay()]}, ${MONTHS[cur.getMonth()]} ${cur.getDate()}`,
          ms,
          mins,
          level,
          isFuture,
        });
      }
      weeks.push({ monthLabel, days: weekDays });
    }

    // Current streak (counting backwards from today or yesterday)
    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = toLocalDateKey(d);
      const focusMs = statsByDate.get(key)?.focus ?? 0;
      if (focusMs > 0) {
        currentStreak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    // Longest streak across recorded dates
    const activeDates = Array.from(statsByDate.entries())
      .filter(([, v]) => v.focus > 0)
      .map(([k]) => k)
      .sort();
    let longestStreak = 0;
    let run = 0;
    let prevTime: number | null = null;
    for (const dateStr of activeDates) {
      const t = new Date(`${dateStr}T00:00:00`).getTime();
      if (prevTime !== null && Math.round((t - prevTime) / 86400000) === 1) {
        run++;
      } else {
        run = 1;
      }
      if (run > longestStreak) longestStreak = run;
      prevTime = t;
    }

    return { weeks, activeDaysCount, currentStreak, longestStreak };
  }, [statsByDate]);

  const goalMinutes = focusGoal > 0 ? Math.round(focusGoal / 60000) : 0;

  const weeklyTrendStats = useMemo(() => {
    if (weeklyTimeFrame === 'all') return filteredStats;
    const daysLimit = weeklyTimeFrame === '12w' ? 84 : 28;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysLimit);
    const cutoffKey = toLocalDateKey(cutoff);
    return filteredStats.filter((s) => s.date >= cutoffKey);
  }, [filteredStats, weeklyTimeFrame]);

  const weeklyTrend = useMemo(() => {
    const dowMap = new Map<
      number,
      {
        totalMs: number;
        datesSet: Set<string>;
        q1: number;
        q2: number;
        q3: number;
        q4: number;
        topicsMap: Map<number, number>;
      }
    >();

    for (const dow of DOW_ORDER) {
      dowMap.set(dow, {
        totalMs: 0,
        datesSet: new Set(),
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
        topicsMap: new Map(),
      });
    }

    for (const s of weeklyTrendStats) {
      const [y, m, d] = s.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dow = dateObj.getDay();
      const entry = dowMap.get(dow);
      if (entry) {
        const focus = totalFocusOfStat(s);
        entry.totalMs += focus;
        if (focus > 0) entry.datesSet.add(s.date);
        entry.q1 += s.focusTimeQ1;
        entry.q2 += s.focusTimeQ2;
        entry.q3 += s.focusTimeQ3;
        entry.q4 += s.focusTimeQ4;
        entry.topicsMap.set(s.topicId, (entry.topicsMap.get(s.topicId) ?? 0) + focus);
      }
    }

    const completedTasksByDow = new Map<number, number>();
    for (const t of filteredTasks) {
      if (t.completedAt) {
        try {
          const d = new Date(t.completedAt);
          if (!isNaN(d.getTime())) {
            const dow = d.getDay();
            completedTasksByDow.set(dow, (completedTasksByDow.get(dow) ?? 0) + 1);
          }
        } catch {
          // Ignore
        }
      }
    }

    const allFocusSum = Array.from(dowMap.values()).reduce((sum, e) => sum + e.totalMs, 0);

    const daysList = DOW_ORDER.map((dow) => {
      const entry = dowMap.get(dow)!;
      const count = entry.datesSet.size;
      const avgMs = count > 0 ? Math.round(entry.totalMs / count) : 0;
      const sharePct = allFocusSum > 0 ? Math.round((entry.totalMs / allFocusSum) * 100) : 0;
      const tasksDone = completedTasksByDow.get(dow) ?? 0;

      return {
        dow,
        shortLabel: DOW_SHORT[dow],
        fullLabel: DOW_FULL[dow],
        totalMs: entry.totalMs,
        avgMs,
        activeDaysCount: count,
        sharePct,
        minutes: Math.round(avgMs / 60000),
        totalMinutes: Math.round(entry.totalMs / 60000),
        q1: entry.q1,
        q2: entry.q2,
        q3: entry.q3,
        q4: entry.q4,
        topicsMap: entry.topicsMap,
        tasksDone,
      };
    });

    const sortedByTotal = [...daysList].sort((a, b) => b.totalMs - a.totalMs);
    const mostProductive = sortedByTotal[0]?.totalMs > 0 ? sortedByTotal[0] : null;
    const activeDaysOnly = sortedByTotal.filter((d) => d.totalMs > 0);
    const leastProductive =
      activeDaysOnly.length > 1 ? activeDaysOnly[activeDaysOnly.length - 1] : null;

    const weekdayTotal = daysList
      .filter((d) => d.dow >= 1 && d.dow <= 5)
      .reduce((sum, d) => sum + d.totalMs, 0);
    const weekendTotal = daysList
      .filter((d) => d.dow === 0 || d.dow === 6)
      .reduce((sum, d) => sum + d.totalMs, 0);
    const weekdayVsWeekendSum = weekdayTotal + weekendTotal;
    const weekdayPct =
      weekdayVsWeekendSum > 0 ? Math.round((weekdayTotal / weekdayVsWeekendSum) * 100) : 0;
    const weekendPct = weekdayVsWeekendSum > 0 ? 100 - weekdayPct : 0;

    let peakQuarter = 'Afternoon (12–16)';
    if (mostProductive) {
      const qMax = Math.max(
        mostProductive.q1,
        mostProductive.q2,
        mostProductive.q3,
        mostProductive.q4
      );
      if (qMax > 0) {
        if (qMax === mostProductive.q1) peakQuarter = 'Morning (00–12)';
        else if (qMax === mostProductive.q2) peakQuarter = 'Afternoon (12–16)';
        else if (qMax === mostProductive.q3) peakQuarter = 'Evening (16–20)';
        else peakQuarter = 'Night (20–24)';
      }
    }

    return {
      daysList,
      mostProductive,
      leastProductive,
      allFocusSum,
      weekdayTotal,
      weekendTotal,
      weekdayPct,
      weekendPct,
      peakQuarter,
    };
  }, [weeklyTrendStats, filteredTasks]);

  // Dedicated Weekly Trend View
  if (subScreen === 'weekly_trend') {
    const mostProductive = weeklyTrend.mostProductive;
    const leastProductive = weeklyTrend.leastProductive;
    const chartData = weeklyTrend.daysList.map((d) => ({
      ...d,
      chartValue: weeklyMetric === 'avg' ? d.minutes : d.totalMinutes,
    }));

    const maxChartValue = Math.max(1, ...chartData.map((d) => d.chartValue));
    const displayedRankings =
      trendSortBy === 'productivity'
        ? [...weeklyTrend.daysList].sort((a, b) => b.totalMs - a.totalMs)
        : weeklyTrend.daysList;

    return (
      <div
        className="min-h-screen pb-28 px-4"
        style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}
      >
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('main')}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-black/5 cursor-pointer"
                aria-label="Back"
              >
                <ArrowLeft size={22} />
              </button>
              <div>
                <h1 className="text-2xl font-extrabold flex items-center gap-2">
                  <TrendingUp size={24} style={{ color: 'var(--m3-primary)' }} />
                  Weekly Trend
                </h1>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Distribution across days of the week
                </p>
              </div>
            </div>

            {/* Time frame selector tabs */}
            <div
              className="flex items-center p-1 rounded-full text-xs font-bold shadow-xs"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              {[
                { id: 'all' as const, label: 'All Time' },
                { id: '12w' as const, label: '12 Weeks' },
                { id: '4w' as const, label: '4 Weeks' },
              ].map((tf) => {
                const active = weeklyTimeFrame === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setWeeklyTimeFrame(tf.id)}
                    className="px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--m3-primary)' : 'transparent',
                      color: active ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                    }}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hero Highlight Card: Most Productive Day */}
          <div
            className="rounded-[28px] p-5 sm:p-6 space-y-4 shadow-sm"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            {mostProductive && mostProductive.totalMs > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    style={{
                      backgroundColor: 'var(--m3-primary)',
                      color: 'var(--m3-on-primary)',
                    }}
                  >
                    <Award size={14} />
                    Most Productive Day
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--m3-outline)' }}>
                    {mostProductive.sharePct}% of your weekly output
                  </span>
                </div>

                <div>
                  <div
                    className="text-4xl sm:text-5xl font-extrabold tracking-tight"
                    style={{ color: 'var(--m3-primary)' }}
                  >
                    {mostProductive.fullLabel}
                  </div>
                  <p className="text-xs sm:text-sm mt-1.5" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    You achieve your highest focus volume on {mostProductive.fullLabel}s, averaging{' '}
                    <strong style={{ color: 'var(--m3-on-surface)' }}>
                      {millisecondsToHoursMinutes(mostProductive.avgMs)}
                    </strong>{' '}
                    per active session day.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                    <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      Avg per {mostProductive.shortLabel}
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">
                      {millisecondsToHoursMinutes(mostProductive.avgMs)}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                    <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      Total Focus
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">
                      {millisecondsToHoursMinutes(mostProductive.totalMs)}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                    <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      Peak Window
                    </div>
                    <div className="text-sm font-bold truncate mt-1">
                      {weeklyTrend.peakQuarter}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                    <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      Tasks Completed
                    </div>
                    <div className="text-lg font-bold tabular-nums mt-0.5">
                      {mostProductive.tasksDone} tasks
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center space-y-2">
                <Calendar size={40} className="mx-auto opacity-35" />
                <h3 className="text-base font-bold">No focus sessions recorded in this period</h3>
                <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Complete focus sessions throughout the week to see your day-by-day distribution and reveal your most productive days!
                </p>
              </div>
            )}
          </div>

          {/* Day-of-Week Distribution Chart */}
          <div
            className="rounded-[28px] p-5 space-y-4 shadow-sm"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Day-of-Week Focus Distribution</h2>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Tap any day bar to inspect its details
                </p>
              </div>

              {/* Metric Toggle: Avg vs Total */}
              <div
                className="flex items-center p-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
              >
                <button
                  type="button"
                  onClick={() => setWeeklyMetric('avg')}
                  className="px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                  style={{
                    backgroundColor: weeklyMetric === 'avg' ? 'var(--m3-primary)' : 'transparent',
                    color: weeklyMetric === 'avg' ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                  }}
                >
                  Avg / Day
                </button>
                <button
                  type="button"
                  onClick={() => setWeeklyMetric('total')}
                  className="px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                  style={{
                    backgroundColor: weeklyMetric === 'total' ? 'var(--m3-primary)' : 'transparent',
                    color: weeklyMetric === 'total' ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                  }}
                >
                  Total Focus
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 10, left: -20, bottom: 5 }}>
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 12, fontWeight: 700, fill: 'var(--m3-on-surface)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--m3-outline)' }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                  />
                  <Tooltip
                    formatter={(val: any) => [
                      millisecondsToHoursMinutes(Number(val) * 60000),
                      weeklyMetric === 'avg' ? 'Daily Average' : 'Total Focus',
                    ]}
                    labelFormatter={(label: any) => {
                      const found = chartData.find((d) => d.shortLabel === label);
                      return found ? `${found.fullLabel} (${found.sharePct}% of week)` : String(label);
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--m3-surface-container-high)',
                      border: 'none',
                      borderRadius: 16,
                      color: 'var(--m3-on-surface)',
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="chartValue"
                    radius={[8, 8, 3, 3]}
                    onClick={(data: any) => setSelectedTrendDow(data?.dow ?? null)}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry) => {
                      const isPeak = mostProductive && entry.dow === mostProductive.dow;
                      const isSelected = selectedTrendDow === entry.dow;
                      let fill = 'var(--m3-surface-container-high)';
                      if (entry.chartValue > 0) {
                        fill = isPeak
                          ? 'var(--m3-primary)'
                          : isSelected
                            ? 'var(--m3-tertiary)'
                            : 'var(--m3-primary-container)';
                      }
                      return <Cell key={`cell-${entry.dow}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & quick helper */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-[var(--m3-outline-variant)]/20"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            >
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--m3-primary)' }} />
                  Peak day ({mostProductive?.shortLabel ?? 'None'})
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--m3-primary-container)' }} />
                  Active days
                </span>
              </div>
              <span className="text-[11px] opacity-75">
                {weeklyMetric === 'avg'
                  ? 'Average focus per active day'
                  : 'Cumulative focus over period'}
              </span>
            </div>
          </div>

          {/* Weekday vs Weekend Rhythm */}
          <div
            className="rounded-[28px] p-5 space-y-3.5 shadow-sm"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Weekday vs. Weekend Balance</h2>
              <span className="text-xs font-bold" style={{ color: 'var(--m3-primary)' }}>
                {weeklyTrend.weekdayPct}% Weekday · {weeklyTrend.weekendPct}% Weekend
              </span>
            </div>

            {/* Proportional dual progress bar */}
            <div className="h-4 w-full rounded-full overflow-hidden flex gap-1 bg-[var(--m3-surface-container-high)]">
              {weeklyTrend.weekdayPct > 0 && (
                <div
                  className="transition-all duration-500 rounded-l-full"
                  style={{
                    width: `${weeklyTrend.weekdayPct}%`,
                    backgroundColor: 'var(--m3-primary)',
                  }}
                  title={`Weekdays: ${weeklyTrend.weekdayPct}%`}
                />
              )}
              {weeklyTrend.weekendPct > 0 && (
                <div
                  className="transition-all duration-500 rounded-r-full"
                  style={{
                    width: `${weeklyTrend.weekendPct}%`,
                    backgroundColor: 'var(--m3-tertiary)',
                  }}
                  title={`Weekends: ${weeklyTrend.weekendPct}%`}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div
                className="p-3 rounded-2xl flex items-center justify-between"
                style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
              >
                <div>
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: 'var(--m3-on-surface-variant)' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--m3-primary)' }} />
                    Weekdays (Mon–Fri)
                  </div>
                  <div className="text-lg font-bold tabular-nums mt-0.5">
                    {millisecondsToHoursMinutes(weeklyTrend.weekdayTotal)}
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums opacity-80">{weeklyTrend.weekdayPct}%</span>
              </div>

              <div
                className="p-3 rounded-2xl flex items-center justify-between"
                style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
              >
                <div>
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: 'var(--m3-on-surface-variant)' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--m3-tertiary)' }} />
                    Weekends (Sat–Sun)
                  </div>
                  <div className="text-lg font-bold tabular-nums mt-0.5">
                    {millisecondsToHoursMinutes(weeklyTrend.weekendTotal)}
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums opacity-80">{weeklyTrend.weekendPct}%</span>
              </div>
            </div>
          </div>

          {/* Day-by-Day Rankings & Deep Dive */}
          <div
            className="rounded-[28px] p-5 space-y-4 shadow-sm"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Day-by-Day Details</h2>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Sorted {trendSortBy === 'productivity' ? 'by productivity (#1 to #7)' : 'by day (Monday to Sunday)'}
                </p>
              </div>

              {/* Sort toggle */}
              <div
                className="flex items-center p-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
              >
                <button
                  type="button"
                  onClick={() => setTrendSortBy('day')}
                  className="px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                  style={{
                    backgroundColor: trendSortBy === 'day' ? 'var(--m3-primary)' : 'transparent',
                    color: trendSortBy === 'day' ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                  }}
                >
                  By Day
                </button>
                <button
                  type="button"
                  onClick={() => setTrendSortBy('productivity')}
                  className="px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                  style={{
                    backgroundColor: trendSortBy === 'productivity' ? 'var(--m3-primary)' : 'transparent',
                    color: trendSortBy === 'productivity' ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                  }}
                >
                  Ranked
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {displayedRankings.map((dayData, idx) => {
                const isSelected = selectedTrendDow === dayData.dow;
                const isPeak = mostProductive && dayData.dow === mostProductive.dow;
                const relPct = maxChartValue > 0 ? Math.round((dayData.minutes / maxChartValue) * 100) : 0;
                const dayQSum = dayData.q1 + dayData.q2 + dayData.q3 + dayData.q4;

                return (
                  <div
                    key={dayData.dow}
                    onClick={() => setSelectedTrendDow(isSelected ? null : dayData.dow)}
                    className="p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01]"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--m3-surface-container-high)'
                        : 'var(--m3-surface-container-low)',
                      border: isPeak ? '1px solid var(--m3-primary)' : '1px solid transparent',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            backgroundColor: isPeak
                              ? 'var(--m3-primary)'
                              : 'var(--m3-surface-container-highest)',
                            color: isPeak ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                          }}
                        >
                          {trendSortBy === 'productivity' ? idx + 1 : dayData.shortLabel.slice(0, 2)}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm">{dayData.fullLabel}</span>
                            {isPeak && (
                              <span
                                className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold"
                                style={{
                                  backgroundColor: 'var(--m3-primary-container)',
                                  color: 'var(--m3-on-primary-container)',
                                }}
                              >
                                PEAK
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] opacity-75">
                            {dayData.activeDaysCount} active days · {dayData.sharePct}% of week
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold tabular-nums">
                          {millisecondsToHoursMinutes(dayData.avgMs)}{' '}
                          <span className="text-[10px] font-normal opacity-70">avg</span>
                        </div>
                        <div className="text-[11px] opacity-70 tabular-nums">
                          {millisecondsToHoursMinutes(dayData.totalMs)} total
                        </div>
                      </div>
                    </div>

                    {/* Progress visual bar */}
                    <div className="h-1.5 w-full rounded-full bg-[var(--m3-surface-container-highest)] mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${relPct}%`,
                          backgroundColor: isPeak ? 'var(--m3-primary)' : 'var(--m3-tertiary)',
                        }}
                      />
                    </div>

                    {/* Expanded day details */}
                    {isSelected && (
                      <div className="mt-3.5 pt-3 border-t border-[var(--m3-outline-variant)]/20 space-y-3">
                        {/* Time of day mini bar */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                            <span style={{ color: 'var(--m3-on-surface-variant)' }}>
                              Time of day breakdown
                            </span>
                            <span className="tabular-nums">
                              {dayData.tasksDone > 0 ? `${dayData.tasksDone} tasks done` : '0 tasks'}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full overflow-hidden flex gap-0.5 bg-[var(--m3-surface-container)]">
                            {dayQSum > 0 ? (
                              <>
                                <div
                                  style={{
                                    width: `${(dayData.q1 / dayQSum) * 100}%`,
                                    backgroundColor: 'var(--m3-primary)',
                                  }}
                                  title={`Morning: ${millisecondsToHoursMinutes(dayData.q1)}`}
                                />
                                <div
                                  style={{
                                    width: `${(dayData.q2 / dayQSum) * 100}%`,
                                    backgroundColor: 'var(--m3-tertiary)',
                                  }}
                                  title={`Afternoon: ${millisecondsToHoursMinutes(dayData.q2)}`}
                                />
                                <div
                                  style={{
                                    width: `${(dayData.q3 / dayQSum) * 100}%`,
                                    backgroundColor: 'var(--m3-secondary)',
                                  }}
                                  title={`Evening: ${millisecondsToHoursMinutes(dayData.q3)}`}
                                />
                                <div
                                  style={{
                                    width: `${(dayData.q4 / dayQSum) * 100}%`,
                                    backgroundColor: 'var(--m3-outline)',
                                  }}
                                  title={`Night: ${millisecondsToHoursMinutes(dayData.q4)}`}
                                />
                              </>
                            ) : (
                              <div className="w-full bg-[var(--m3-outline-variant)] opacity-20" />
                            )}
                          </div>
                        </div>

                        {/* Topics studied on this day */}
                        {dayData.topicsMap.size > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span
                              className="text-[11px] font-bold"
                              style={{ color: 'var(--m3-on-surface-variant)' }}
                            >
                              Top topics on {dayData.fullLabel}s
                            </span>
                            <div className="space-y-1">
                              {Array.from(dayData.topicsMap.entries())
                                .sort((a, b) => b[1] - a[1])
                                .map(([topicId, ms]) => {
                                  const topic = topics.find((t) => t.id === topicId);
                                  return (
                                    <div
                                      key={topicId}
                                      className="flex items-center justify-between p-2 rounded-xl text-xs font-semibold"
                                      style={{ backgroundColor: 'var(--m3-surface-container)' }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <TopicShapeIcon
                                          shape={topic?.shape ?? 'CIRCLE'}
                                          color={topic?.color ?? '#ffffff'}
                                          size={14}
                                        />
                                        <span>{topic?.name ?? 'Topic'}</span>
                                      </div>
                                      <span className="tabular-nums font-bold">
                                        {millisecondsToHoursMinutes(ms)}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actionable Insights Card */}
          <div
            className="rounded-[28px] p-5 space-y-3 shadow-sm"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: 'var(--m3-primary)' }} />
              <h2 className="text-base font-bold">Productivity Insights</h2>
            </div>
            <div className="space-y-2 text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {mostProductive && mostProductive.totalMs > 0 ? (
                <>
                  <p className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                    🔥 <strong>Peak Power:</strong> {mostProductive.fullLabel} is your most focused day of the week ({millisecondsToHoursMinutes(mostProductive.avgMs)} avg). Schedule your hardest blitz sessions and high-priority milestones on this day!
                  </p>
                  {leastProductive && leastProductive.dow !== mostProductive.dow && (
                    <p className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                      ☕ <strong>Rest & Planning:</strong> {leastProductive.fullLabel} has your lowest focus time ({millisecondsToHoursMinutes(leastProductive.avgMs)} avg). Perfect for backlog grooming, planning your upcoming week, or restorative downtime.
                    </p>
                  )}
                  <p className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                    ⏰ <strong>Prime Window:</strong> Your concentration peaks in the {weeklyTrend.peakQuarter}. Protect this window from interruptions!
                  </p>
                </>
              ) : (
                <p className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--m3-surface-container-low)' }}>
                  💡 Log your daily focus pomodoros to generate personalized insights on your peak hours and high-performance days.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subScreen !== 'main') {
    const title =
      subScreen === 'last_week'
        ? 'Last week'
        : subScreen === 'last_month'
          ? 'Last month'
          : 'Last year';
    const data =
      subScreen === 'last_week'
        ? lastWeekData
        : subScreen === 'last_month'
          ? lastMonthData
          : lastYearData;
    const avg =
      subScreen === 'last_week'
        ? lastWeekAvg
        : subScreen === 'last_month'
          ? lastMonthAvg
          : lastYearAvg;

    const qTotals = data.reduce(
      (acc, d) => ({
        q1: acc.q1 + d.q1,
        q2: acc.q2 + d.q2,
        q3: acc.q3 + d.q3,
        q4: acc.q4 + d.q4,
      }),
      { q1: 0, q2: 0, q3: 0, q4: 0 }
    );
    const qSum = qTotals.q1 + qTotals.q2 + qTotals.q3 + qTotals.q4;

    const rangeKeys = new Set(
      subScreen === 'last_year'
        ? lastYearData.map((d) => d.key)
        : (subScreen === 'last_week' ? lastWeekData : lastMonthData).map((d) => d.date)
    );
    const topicTotals = new Map<number, number>();
    for (const s of filteredStats) {
      const matchKey = subScreen === 'last_year' ? s.date.slice(0, 7) : s.date;
      if (rangeKeys.has(matchKey)) {
        topicTotals.set(s.topicId, (topicTotals.get(s.topicId) ?? 0) + totalFocusOfStat(s));
      }
    }

    const quarterLabels = [
      { label: 'Morning (00–12)', ms: qTotals.q1, color: 'var(--m3-primary)' },
      { label: 'Afternoon (12–16)', ms: qTotals.q2, color: 'var(--m3-tertiary)' },
      { label: 'Evening (16–20)', ms: qTotals.q3, color: 'var(--m3-secondary)' },
      { label: 'Night (20–24)', ms: qTotals.q4, color: 'var(--m3-outline)' },
    ];

    return (
      <div
        className="min-h-screen pb-28 px-4"
        style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}
      >
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('main')}
              className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-black/5 cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={22} />
            </button>
            <h1 className="text-2xl font-extrabold">{title}</h1>
          </div>

          <div
            className="rounded-[28px] p-5 space-y-4"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tabular-nums">
                {millisecondsToHoursMinutes(avg)}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                focus / day avg
              </span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {subScreen === 'last_year' ? (
                  <LineChart data={data}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--m3-outline)' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(val: number) => [millisecondsToHoursMinutes(val * 60000), 'Focus']}
                      contentStyle={{
                        backgroundColor: 'var(--m3-surface-container-high)',
                        border: 'none',
                        borderRadius: 16,
                        color: 'var(--m3-on-surface)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="minutes"
                      stroke="var(--m3-primary)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: 'var(--m3-primary)' }}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={data}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--m3-outline)' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(val: number) => [millisecondsToHoursMinutes(val * 60000), 'Focus']}
                      contentStyle={{
                        backgroundColor: 'var(--m3-surface-container-high)',
                        border: 'none',
                        borderRadius: 16,
                        color: 'var(--m3-on-surface)',
                      }}
                    />
                    {goalMinutes > 0 && (
                      <ReferenceLine y={goalMinutes} stroke="var(--m3-tertiary)" strokeDasharray="4 4" />
                    )}
                    <Bar dataKey="minutes" fill="var(--m3-primary)" radius={[8, 8, 4, 4]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time-of-day breakdown */}
          <div
            className="rounded-[28px] p-5 space-y-4"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <h2 className="text-lg font-bold">Time of day breakdown</h2>
            <div className="h-4 w-full rounded-full overflow-hidden flex gap-0.5" style={{ backgroundColor: 'var(--m3-surface-container-high)' }}>
              {qSum > 0 &&
                quarterLabels.map((q) =>
                  q.ms > 0 ? (
                    <div
                      key={q.label}
                      style={{
                        width: `${(q.ms / qSum) * 100}%`,
                        backgroundColor: q.color,
                      }}
                    />
                  ) : null
                )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quarterLabels.map((q) => (
                <div
                  key={q.label}
                  className="p-3 rounded-2xl flex items-center justify-between"
                  style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                    <span className="text-xs font-semibold truncate">{q.label}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums ml-2">
                    {millisecondsToHoursMinutes(q.ms)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Topic breakdown */}
          <div
            className="rounded-[28px] p-5 space-y-3"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <h2 className="text-lg font-bold">By topic</h2>
            {topicTotals.size === 0 ? (
              <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
                No focus sessions recorded in this period yet.
              </p>
            ) : (
              <div className="space-y-2">
                {Array.from(topicTotals.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([topicId, ms]) => {
                    const topic = topics.find((t) => t.id === topicId);
                    return (
                      <div
                        key={topicId}
                        className="flex items-center justify-between p-3 rounded-2xl"
                        style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <TopicShapeIcon
                            shape={topic?.shape ?? 'CIRCLE'}
                            color={topic?.color ?? '#ffffff'}
                            size={18}
                          />
                          <span className="text-sm font-semibold">{topic?.name ?? 'Topic'}</span>
                        </div>
                        <span className="text-sm font-bold tabular-nums">
                          {millisecondsToHoursMinutes(ms)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-28 px-4"
      style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}
    >
      <div className="max-w-2xl mx-auto pt-6 space-y-5">
        <header className="text-center pb-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Stats</h1>
        </header>

        {/* Multi-Select Topic Filter */}
        <section className="flex flex-wrap items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => setSelectedTopicIds([])}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
            style={{
              backgroundColor:
                selectedTopicIds.length === 0
                  ? 'var(--m3-primary)'
                  : 'var(--m3-surface-bright)',
              color:
                selectedTopicIds.length === 0
                  ? 'var(--m3-on-primary)'
                  : 'var(--m3-on-surface-variant)',
            }}
          >
            {selectedTopicIds.length === 0 && <Check size={13} />}
            All Topics
          </button>

          {topics.map((topic) => {
            const active = selectedTopicIds.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopicFilter(topic.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
                style={{
                  backgroundColor: active
                    ? 'var(--m3-primary-container)'
                    : 'var(--m3-surface-bright)',
                  color: active
                    ? 'var(--m3-on-primary-container)'
                    : 'var(--m3-on-surface)',
                }}
              >
                <TopicShapeIcon shape={topic.shape} color={topic.color} size={13} />
                <span>{topic.name}</span>
                {active && <Check size={12} />}
              </button>
            );
          })}
        </section>

        {/* Today */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold px-2">Today</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <div
              className="rounded-[24px] p-4 flex items-center justify-between gap-2"
              style={{
                backgroundColor: 'var(--m3-primary-container)',
                color: 'var(--m3-on-primary-container)',
              }}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold opacity-90">Focus</div>
                <div className="text-3xl font-extrabold tabular-nums mt-1">
                  {millisecondsToHoursMinutes(todaySummary.focus)}
                </div>
                {focusGoal > 0 && (
                  <div className="text-[11px] font-semibold opacity-70 mt-0.5 tabular-nums">
                    Goal: {millisecondsToHoursMinutes(focusGoal)}
                  </div>
                )}
              </div>
              {focusGoal > 0 && (() => {
                const ratio = Math.min(1, Math.max(0, todaySummary.focus / focusGoal));
                const pct = Math.min(100, Math.round(ratio * 100));
                const ringSize = 54;
                const stroke = 4.5;
                const r = (ringSize - stroke) / 2;
                const circ = 2 * Math.PI * r;
                const offset = circ * (1 - ratio);
                return (
                  <div
                    className="relative shrink-0 flex items-center justify-center"
                    style={{ width: ringSize, height: ringSize }}
                    title={`Daily focus goal: ${pct}% (${millisecondsToHoursMinutes(todaySummary.focus)} / ${millisecondsToHoursMinutes(focusGoal)})`}
                    aria-label={`Daily focus goal ${pct}% achieved`}
                  >
                    <svg width={ringSize} height={ringSize} className="-rotate-90">
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={0.2}
                        strokeWidth={stroke}
                      />
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={r}
                        fill="none"
                        stroke="var(--m3-primary)"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 450ms ease' }}
                      />
                    </svg>
                    <span className="absolute text-[11px] font-extrabold tabular-nums opacity-90">
                      {pct}%
                    </span>
                  </div>
                );
              })()}
            </div>
            <div
              className="rounded-[24px] p-4 flex flex-col justify-center"
              style={{
                backgroundColor: 'var(--m3-tertiary-container)',
                color: 'var(--m3-on-tertiary-container)',
              }}
            >
              <div className="text-sm font-semibold opacity-90">Break</div>
              <div className="text-3xl font-extrabold tabular-nums mt-1">
                {millisecondsToHoursMinutes(todaySummary.breakTime)}
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Focus Distribution (Daily / Weekly / Monthly) */}
        <section
          className="rounded-[24px] p-5 space-y-4"
          style={{ backgroundColor: 'var(--m3-surface-bright)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} style={{ color: 'var(--m3-primary)' }} />
              <div>
                <h2 className="text-xl font-bold leading-tight">Focus Distribution</h2>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  {distributionView === 'daily'
                    ? "Today's time-of-day breakdown"
                    : distributionView === 'weekly'
                      ? 'Last 7 days focus distribution'
                      : 'Last 30 days focus distribution'}
                </p>
              </div>
            </div>

            <div
              className="flex items-center p-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
              role="tablist"
              aria-label="Focus distribution timeframe"
            >
              {(
                [
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ] as const
              ).map((tab) => {
                const active = distributionView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDistributionView(tab.id)}
                    className="px-3 py-1 rounded-full cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--m3-primary)' : 'transparent',
                      color: active ? 'var(--m3-on-primary)' : 'var(--m3-on-surface-variant)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary metrics for selected view */}
          <div className="grid grid-cols-3 gap-2">
            <div
              className="p-3 rounded-2xl"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Total Focus
              </div>
              <div className="text-base sm:text-lg font-extrabold tabular-nums mt-0.5">
                {millisecondsToHoursMinutes(
                  distributionView === 'daily'
                    ? todaySummary.focus
                    : distributionView === 'weekly'
                      ? focusDistribution.weeklyTotal
                      : focusDistribution.monthlyTotal
                )}
              </div>
            </div>

            <div
              className="p-3 rounded-2xl"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {distributionView === 'daily' ? 'Break Time' : 'Daily Avg'}
              </div>
              <div className="text-base sm:text-lg font-extrabold tabular-nums mt-0.5">
                {millisecondsToHoursMinutes(
                  distributionView === 'daily'
                    ? todaySummary.breakTime
                    : distributionView === 'weekly'
                      ? lastWeekAvg
                      : lastMonthAvg
                )}
              </div>
            </div>

            <div
              className="p-3 rounded-2xl"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {distributionView === 'daily'
                  ? 'Peak Window'
                  : distributionView === 'weekly'
                    ? 'Peak Day'
                    : 'Active Days'}
              </div>
              <div className="text-base sm:text-lg font-extrabold tabular-nums mt-0.5 truncate">
                {distributionView === 'daily'
                  ? (focusDistribution.dailyPeak?.label ?? '—')
                  : distributionView === 'weekly'
                    ? (focusDistribution.weeklyPeak?.label ?? '—')
                    : `${focusDistribution.monthlyActiveDays} / 30`}
              </div>
            </div>
          </div>

          {/* Recharts BarChart */}
          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              {distributionView === 'daily' ? (
                <BarChart
                  data={focusDistribution.dailyData}
                  margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--m3-outline-variant)"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--m3-on-surface-variant)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--m3-outline)' }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                  />
                  <Tooltip
                    formatter={(val: number) => [millisecondsToHoursMinutes(Number(val) * 60000), 'Focus']}
                    labelFormatter={(label: string) => {
                      const found = focusDistribution.dailyData.find((d) => d.label === label);
                      return found ? found.fullLabel : label;
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--m3-surface-container-high)',
                      border: 'none',
                      borderRadius: 16,
                      color: 'var(--m3-on-surface)',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="minutes" radius={[8, 8, 3, 3]} maxBarSize={48}>
                    {focusDistribution.dailyData.map((entry) => (
                      <Cell
                        key={`daily-${entry.label}`}
                        fill={entry.minutes > 0 ? entry.color : 'var(--m3-surface-container-high)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : distributionView === 'weekly' ? (
                <BarChart
                  data={lastWeekData}
                  margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--m3-outline-variant)"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--m3-on-surface-variant)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--m3-outline)' }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                  />
                  <Tooltip
                    formatter={(val: number) => [millisecondsToHoursMinutes(Number(val) * 60000), 'Focus']}
                    labelFormatter={(_label: string, payload: readonly { payload?: { date?: string; label?: string } }[]) => {
                      const item = payload?.[0]?.payload;
                      return item?.date ? `${item.label} · ${item.date}` : _label;
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--m3-surface-container-high)',
                      border: 'none',
                      borderRadius: 16,
                      color: 'var(--m3-on-surface)',
                      fontSize: 12,
                    }}
                  />
                  {goalMinutes > 0 && (
                    <ReferenceLine
                      y={goalMinutes}
                      stroke="var(--m3-tertiary)"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Bar dataKey="minutes" radius={[8, 8, 3, 3]} maxBarSize={36}>
                    {lastWeekData.map((entry) => {
                      const isPeak =
                        focusDistribution.weeklyPeak &&
                        entry.date === focusDistribution.weeklyPeak.date;
                      return (
                        <Cell
                          key={`weekly-${entry.date}`}
                          fill={
                            entry.minutes === 0
                              ? 'var(--m3-surface-container-high)'
                              : isPeak
                                ? 'var(--m3-primary)'
                                : 'var(--m3-primary-container)'
                          }
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={lastMonthData}
                  margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--m3-outline-variant)"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    interval={4}
                    tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--m3-on-surface-variant)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--m3-outline)' }}
                    axisLine={false}
                    tickLine={false}
                    unit="m"
                  />
                  <Tooltip
                    formatter={(val: number) => [millisecondsToHoursMinutes(Number(val) * 60000), 'Focus']}
                    labelFormatter={(_label: string, payload: readonly { payload?: { date?: string } }[]) => {
                      const item = payload?.[0]?.payload;
                      return item?.date ?? _label;
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--m3-surface-container-high)',
                      border: 'none',
                      borderRadius: 16,
                      color: 'var(--m3-on-surface)',
                      fontSize: 12,
                    }}
                  />
                  {goalMinutes > 0 && (
                    <ReferenceLine
                      y={goalMinutes}
                      stroke="var(--m3-tertiary)"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Bar dataKey="minutes" radius={[4, 4, 2, 2]}>
                    {lastMonthData.map((entry) => {
                      const isPeak =
                        focusDistribution.monthlyPeak &&
                        entry.date === focusDistribution.monthlyPeak.date;
                      return (
                        <Cell
                          key={`monthly-${entry.date}`}
                          fill={
                            entry.minutes === 0
                              ? 'var(--m3-surface-container-high)'
                              : isPeak
                                ? 'var(--m3-primary)'
                                : 'var(--m3-primary-container)'
                          }
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* GitHub-Style Consistency Heatmap & Focus Streak */}
        <section
          className="rounded-[24px] p-5 space-y-3.5"
          style={{ backgroundColor: 'var(--m3-surface-bright)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame size={20} style={{ color: 'var(--m3-primary)' }} />
              <h2 className="text-xl font-bold">Consistency Heatmap</h2>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <span
                className="px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: 'var(--m3-primary-container)',
                  color: 'var(--m3-on-primary-container)',
                }}
              >
                {streakAndHeatmap.currentStreak}d streak
              </span>
              <span style={{ color: 'var(--m3-on-surface-variant)' }}>
                Best: {streakAndHeatmap.longestStreak}d
              </span>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="inline-flex flex-col gap-1.5 min-w-full">
              {/* Month labels row */}
              <div className="flex items-center gap-1.5 pl-8">
                {streakAndHeatmap.weeks.map((week, idx) => (
                  <div
                    key={idx}
                    className="w-3.5 sm:w-4 text-[10px] font-semibold leading-none shrink-0"
                    style={{ color: 'var(--m3-on-surface-variant)' }}
                  >
                    {week.monthLabel}
                  </div>
                ))}
              </div>

              {/* Weekday labels + 16-week grid */}
              <div className="flex gap-1.5">
                <div
                  className="grid grid-rows-7 gap-1.5 text-[10px] font-semibold pr-1 shrink-0 w-7"
                  style={{ color: 'var(--m3-on-surface-variant)' }}
                >
                  <span />
                  <span className="leading-3.5 sm:leading-4">Mon</span>
                  <span />
                  <span className="leading-3.5 sm:leading-4">Wed</span>
                  <span />
                  <span className="leading-3.5 sm:leading-4">Fri</span>
                  <span />
                </div>

                <div className="flex gap-1.5">
                  {streakAndHeatmap.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="grid grid-rows-7 gap-1.5">
                      {week.days.map((cell) => {
                        const opacity =
                          cell.isFuture
                            ? 0.06
                            : cell.level === 0
                              ? 0.2
                              : cell.level === 1
                                ? 0.4
                                : cell.level === 2
                                  ? 0.65
                                  : cell.level === 3
                                    ? 0.85
                                    : 1;
                        return (
                          <button
                            key={cell.key}
                            type="button"
                            disabled={cell.isFuture}
                            onMouseEnter={() => setHoveredCell({ label: cell.label, ms: cell.ms })}
                            onFocus={() => setHoveredCell({ label: cell.label, ms: cell.ms })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => setHoveredCell({ label: cell.label, ms: cell.ms })}
                            title={`${cell.label}: ${cell.mins > 0 ? millisecondsToHoursMinutes(cell.ms) : 'No focus'}`}
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[4px] transition-transform hover:scale-125 focus:outline-none cursor-pointer disabled:cursor-default disabled:hover:scale-100"
                            style={{
                              backgroundColor:
                                cell.level === 0 || cell.isFuture
                                  ? 'var(--m3-outline-variant)'
                                  : 'var(--m3-primary)',
                              opacity,
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive footer + GitHub-style intensity legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]" style={{ color: 'var(--m3-on-surface-variant)' }}>
            <span className="font-semibold">
              {hoveredCell
                ? `${hoveredCell.label} · ${hoveredCell.ms > 0 ? millisecondsToHoursMinutes(hoveredCell.ms) : 'No focus'}`
                : `${streakAndHeatmap.activeDaysCount} active days in the last 16 weeks`}
            </span>
            <div className="flex items-center gap-1">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((lvl) => (
                <span
                  key={lvl}
                  className="w-3 h-3 rounded-[3px] inline-block"
                  style={{
                    backgroundColor:
                      lvl === 0 ? 'var(--m3-outline-variant)' : 'var(--m3-primary)',
                    opacity: lvl === 0 ? 0.2 : lvl === 1 ? 0.4 : lvl === 2 ? 0.65 : lvl === 3 ? 0.85 : 1,
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </section>

        {/* Weekly Trend Section */}
        <section>
          <button
            type="button"
            onClick={() => onNavigate('weekly_trend')}
            className="w-full text-left rounded-[24px] p-5 space-y-3.5 transition-all hover:scale-[1.005] hover:shadow-md cursor-pointer border border-[var(--m3-outline-variant)]/20"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'var(--m3-primary-container)',
                    color: 'var(--m3-on-primary-container)',
                  }}
                >
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Weekly Trend</h2>
                  <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Day-of-week productivity distribution
                  </p>
                </div>
              </div>

              {weeklyTrend.mostProductive && weeklyTrend.mostProductive.totalMs > 0 ? (
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  style={{
                    backgroundColor: 'var(--m3-primary)',
                    color: 'var(--m3-on-primary)',
                  }}
                >
                  <Award size={13} />
                  Peak: {weeklyTrend.mostProductive.fullLabel}
                </span>
              ) : (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: 'var(--m3-surface-container-high)',
                    color: 'var(--m3-on-surface-variant)',
                  }}
                >
                  View distribution
                </span>
              )}
            </div>

            {/* Quick metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <div
                className="p-3 rounded-2xl"
                style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
              >
                <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Most Productive
                </div>
                <div className="text-base font-extrabold mt-0.5" style={{ color: 'var(--m3-primary)' }}>
                  {weeklyTrend.mostProductive && weeklyTrend.mostProductive.totalMs > 0
                    ? weeklyTrend.mostProductive.fullLabel
                    : '—'}
                </div>
                <div className="text-[11px] opacity-75 tabular-nums">
                  {weeklyTrend.mostProductive && weeklyTrend.mostProductive.totalMs > 0
                    ? `${millisecondsToHoursMinutes(weeklyTrend.mostProductive.avgMs)} avg`
                    : 'No sessions'}
                </div>
              </div>

              <div
                className="p-3 rounded-2xl"
                style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
              >
                <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Weekday vs Weekend
                </div>
                <div className="text-base font-extrabold mt-0.5 tabular-nums">
                  {weeklyTrend.weekdayPct}% / {weeklyTrend.weekendPct}%
                </div>
                <div className="text-[11px] opacity-75">
                  {weeklyTrend.weekdayPct >= 65 ? 'Weekday focused' : 'Evenly distributed'}
                </div>
              </div>

              <div
                className="p-3 rounded-2xl col-span-2 sm:col-span-1"
                style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
              >
                <div className="text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Peak Focus Window
                </div>
                <div className="text-sm font-bold truncate mt-1">
                  {weeklyTrend.peakQuarter}
                </div>
                <div className="text-[11px] opacity-75">
                  Best time of day
                </div>
              </div>
            </div>

            {/* Mini Day-of-Week Chart */}
            <div className="h-28 w-full pointer-events-none pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyTrend.daysList} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--m3-outline)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Bar dataKey="minutes" radius={[6, 6, 2, 2]}>
                    {weeklyTrend.daysList.map((entry) => (
                      <Cell
                        key={`cell-${entry.dow}`}
                        fill={
                          weeklyTrend.mostProductive &&
                          entry.dow === weeklyTrend.mostProductive.dow &&
                          entry.minutes > 0
                            ? 'var(--m3-primary)'
                            : entry.minutes > 0
                              ? 'var(--m3-primary-container)'
                              : 'var(--m3-surface-container-high)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div
              className="flex items-center justify-between pt-1 text-xs font-semibold"
              style={{ color: 'var(--m3-primary)' }}
            >
              <span className="flex items-center gap-1.5" style={{ color: 'var(--m3-on-surface-variant)' }}>
                <Calendar size={14} />
                Identify habits & peak days
              </span>
              <span className="flex items-center gap-1 font-bold">
                Explore Weekly Trend <ChevronRight size={14} />
              </span>
            </div>
          </button>
        </section>

        {/* Segmented Period Cards */}
        <section className="space-y-1">
          {/* Last Week */}
          <button
            type="button"
            onClick={() => onNavigate('last_week')}
            className="w-full text-left rounded-t-[24px] rounded-b-[6px] p-5 space-y-3 transition-opacity hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Last week</span>
              <BarChart3 size={20} style={{ color: 'var(--m3-on-surface-variant)' }} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums">
                {millisecondsToHoursMinutes(lastWeekAvg)}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                focus / day avg
              </span>
            </div>
            <div className="h-36 w-full pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lastWeekData}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--m3-outline)' }} axisLine={false} tickLine={false} />
                  {goalMinutes > 0 && (
                    <ReferenceLine y={goalMinutes} stroke="var(--m3-tertiary)" strokeDasharray="3 3" />
                  )}
                  <Bar dataKey="minutes" fill="var(--m3-primary)" radius={[6, 6, 3, 3]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </button>

          {/* Last Month */}
          <button
            type="button"
            onClick={() => onNavigate('last_month')}
            className="w-full text-left rounded-[6px] p-5 space-y-3 transition-opacity hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Last month</span>
              <BarChart3 size={20} style={{ color: 'var(--m3-on-surface-variant)' }} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums">
                {millisecondsToHoursMinutes(lastMonthAvg)}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                focus / day avg
              </span>
            </div>
            <div className="h-32 w-full pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lastMonthData}>
                  <XAxis dataKey="label" interval={4} tick={{ fontSize: 10, fill: 'var(--m3-outline)' }} axisLine={false} tickLine={false} />
                  <Bar dataKey="minutes" fill="var(--m3-primary)" radius={[4, 4, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </button>

          {/* Last Year */}
          <button
            type="button"
            onClick={() => onNavigate('last_year')}
            className="w-full text-left rounded-t-[6px] rounded-b-[24px] p-5 space-y-3 transition-opacity hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">Last year</span>
              <BarChart3 size={20} style={{ color: 'var(--m3-on-surface-variant)' }} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums">
                {millisecondsToHoursMinutes(lastYearAvg)}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                focus / day avg
              </span>
            </div>
            <div className="h-32 w-full pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lastYearData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--m3-outline)' }} axisLine={false} tickLine={false} />
                  <Line type="monotone" dataKey="minutes" stroke="var(--m3-primary)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </button>
        </section>

        {/* Lifetime */}
        <section
          className="rounded-[24px] p-5 space-y-2"
          style={{ backgroundColor: 'var(--m3-surface-bright)' }}
        >
          <h2 className="text-xl font-bold">Lifetime</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tabular-nums">
              {millisecondsToHoursMinutes(lifetimeTotal)}
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
              total
            </span>
          </div>
        </section>

        {/* Completed Tasks: Estimated vs Actual */}
        <section
          className="rounded-[24px] p-5 space-y-3"
          style={{ backgroundColor: 'var(--m3-surface-bright)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Completed tasks</h2>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: 'var(--m3-secondary-container)',
                color: 'var(--m3-on-secondary-container)',
              }}
            >
              {completedTasksStats.count} done
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div
              className="rounded-2xl p-3.5"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Estimated
              </div>
              <div className="text-2xl font-extrabold tabular-nums mt-0.5">
                {millisecondsToHoursMinutes(completedTasksStats.estMs)}
              </div>
            </div>
            <div
              className="rounded-2xl p-3.5"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Actual
              </div>
              <div className="text-2xl font-extrabold tabular-nums mt-0.5">
                {millisecondsToHoursMinutes(completedTasksStats.actualMs)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

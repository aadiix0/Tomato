import React, { useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Check, Flame } from 'lucide-react';
import {
  Bar,
  BarChart,
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
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const StatsScreen: React.FC<StatsScreenProps> = ({
  stats,
  topics,
  tasks,
  focusGoal,
  subScreen,
  onNavigate,
}) => {
  const todayKey = toLocalDateKey();
  // Empty array means "All topics"
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ label: string; ms: number } | null>(null);

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
        style={{ backgroundColor: 'var(--m3-surface-container)' }}
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
      style={{ backgroundColor: 'var(--m3-surface-container)' }}
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
              className="rounded-[24px] p-4"
              style={{
                backgroundColor: 'var(--m3-primary-container)',
                color: 'var(--m3-on-primary-container)',
              }}
            >
              <div className="text-sm font-semibold opacity-90">Focus</div>
              <div className="text-3xl font-extrabold tabular-nums mt-1">
                {millisecondsToHoursMinutes(todaySummary.focus)}
              </div>
            </div>
            <div
              className="rounded-[24px] p-4"
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

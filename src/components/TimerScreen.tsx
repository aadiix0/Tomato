import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Infinity as InfinityIcon,
  ListPlus,
  NotebookPen,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SkipForward,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { Task, TimerState, Topic } from '../types';
import { TopicShapeIcon } from './TopicShapeIcon';
import { FocusToolsBar } from './FocusToolsBar';

interface TimerScreenProps {
  timerState: TimerState;
  topics: Topic[];
  currentTopic: Topic;
  activeTask: Task | null;
  sessionActive: boolean;
  progress: number;
  aodEnabled: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onUndoReset: () => void;
  onSkipTimer: () => void;
  onToggleInfiniteFocus: () => boolean;
  onSelectTopic: (topicId: number) => void;
  onAddTopic: () => void;
  onOpenTopicSettings: () => void;
  onEnterAod: () => void;
  onCompleteActiveTask: () => void;
  onOpenPiP: () => void;
  onSendNoteToBacklog: (title: string) => void;
  hasCustomBg?: boolean;
  isDark?: boolean;
  timerLayoutStyle?: 'wavy_circle' | 'minimalist_ring' | 'cyber_box' | 'clean_minimal';
  breakTimerLayoutStyle?: 'match_focus' | 'wavy_circle' | 'pulsing_bubble' | 'minimalist_ring' | 'cyber_box' | 'clean_minimal';
  timerFontFamily?: 'jakarta' | 'mono' | 'serif' | 'retro';
  timerPulseAnimation?: boolean;
  timerDigitGlow?: boolean;
}

function buildWavyCirclePath(cx: number, cy: number, r: number, amplitude: number, waves: number): string {
  const points = 180;
  const cmds: string[] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
    const rad = r + amplitude * Math.sin(angle * waves);
    const x = cx + rad * Math.cos(angle);
    const y = cy + rad * Math.sin(angle);
    cmds.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return cmds.join(' ') + ' Z';
}

export const TimerScreen: React.FC<TimerScreenProps> = ({
  timerState,
  topics,
  currentTopic,
  activeTask,
  sessionActive,
  progress,
  aodEnabled,
  onToggleTimer,
  onResetTimer,
  onUndoReset,
  onSkipTimer,
  onToggleInfiniteFocus,
  onSelectTopic,
  onAddTopic,
  onOpenTopicSettings,
  onEnterAod,
  onCompleteActiveTask,
  onOpenPiP,
  onSendNoteToBacklog,
  hasCustomBg = false,
  isDark = false,
  timerLayoutStyle = 'wavy_circle',
  breakTimerLayoutStyle = 'wavy_circle',
  timerFontFamily = 'jakarta',
  timerPulseAnimation = true,
  timerDigitGlow = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSessionCount, setShowSessionCount] = useState(true);
  const [snackbar, setSnackbar] = useState<{ message: string; canUndo?: boolean } | null>(null);
  const snackbarTimeout = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isFocus = timerState.timerMode === 'FOCUS';
  const accentColor = isFocus ? 'var(--m3-primary)' : 'var(--m3-tertiary)';
  const onAccentColor = isFocus ? 'var(--m3-on-primary)' : 'var(--m3-on-tertiary)';
  const containerColor = isFocus ? 'var(--m3-secondary-container)' : 'var(--m3-tertiary-container)';
  const onContainerColor = isFocus
    ? 'var(--m3-on-secondary-container)'
    : 'var(--m3-on-tertiary-container)';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const showToast = (message: string, canUndo = false) => {
    if (snackbarTimeout.current) window.clearTimeout(snackbarTimeout.current);
    setSnackbar({ message, canUndo });
    snackbarTimeout.current = window.setTimeout(() => setSnackbar(null), 5000);
  };

  const handleReset = () => {
    onResetTimer();
    showToast('Timer reset', true);
  };

  const handleInfiniteToggle = () => {
    const ok = onToggleInfiniteFocus();
    if (!ok) {
      showToast('Pause or reset the timer to toggle Infinite Focus');
    }
  };

  const titleText = timerState.showBrandTitle
    ? 'Zonein'
    : timerState.timerMode === 'FOCUS'
      ? timerState.infiniteFocus
        ? 'Infinite Focus'
        : 'Focus'
      : timerState.timerMode === 'SHORT_BREAK'
        ? 'Short Break'
        : 'Long Break';

  const titleColor = timerState.showBrandTitle ? 'var(--m3-error)' : accentColor;

  const size = 310;
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const wavyPath = buildWavyCirclePath(size / 2, size / 2, radius, 4.5, 14);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between pb-28 px-4"
      style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface)' }}
    >
      <header className="w-full max-w-2xl flex items-center justify-between pt-5 pb-2 relative">
        <div className="w-11 flex items-center">
          <button
            type="button"
            onClick={handleInfiniteToggle}
            title="Toggle Infinite Focus mode"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            style={{
              backgroundColor: timerState.infiniteFocus
                ? accentColor
                : 'var(--m3-surface-container-high)',
              color: timerState.infiniteFocus ? onAccentColor : 'var(--m3-on-surface-variant)',
            }}
          >
            <InfinityIcon size={20} />
          </button>
        </div>

        <div className="text-center">
          <h1
            className="text-3xl font-extrabold tracking-tight transition-colors duration-300"
            style={{ color: titleColor }}
          >
            {titleText}
          </h1>
          <div
            className="text-sm font-medium mt-0.5 flex items-center justify-center gap-1.5"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          >
            <TopicShapeIcon shape={currentTopic.shape} color={currentTopic.color} size={14} />
            <span>{currentTopic.name}</span>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Switch topic"
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer"
            style={{
              backgroundColor: menuOpen ? accentColor : 'var(--m3-secondary-container)',
              color: menuOpen ? onAccentColor : 'var(--m3-on-secondary-container)',
            }}
          >
            <Tag size={20} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-60 rounded-3xl p-2 shadow-xl z-40 border"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                borderColor: 'var(--m3-outline-variant)',
              }}
            >
              <div className="space-y-1">
                {topics.map((topic) => {
                  const selected = topic.id === currentTopic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      disabled={sessionActive}
                      onClick={() => {
                        onSelectTopic(topic.id);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-left transition-colors disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: selected ? 'var(--m3-primary-container)' : 'transparent',
                        color: selected ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                      }}
                    >
                      <TopicShapeIcon shape={topic.shape} color={topic.color} size={18} />
                      <span className="truncate flex-1">{topic.name}</span>
                      <span className="text-xs opacity-70 tabular-nums">
                        {Math.round(topic.focusTime / 60000)}m
                      </span>
                    </button>
                  );
                })}
              </div>

              {sessionActive && (
                <div
                  className="px-3 py-1.5 text-[11px] font-medium"
                  style={{ color: 'var(--m3-outline)' }}
                >
                  Reset timer to switch topic
                </div>
              )}

              <div
                className="my-2 border-t"
                style={{ borderColor: 'var(--m3-outline-variant)' }}
              />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onAddTopic();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold hover:bg-black/5 transition-colors cursor-pointer"
              >
                <Plus size={18} />
                <span>Create new topic</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenTopicSettings();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold hover:bg-black/5 transition-colors cursor-pointer"
              >
                <Settings2 size={18} />
                <span>Topic settings</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl py-4 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 items-center md:items-start gap-8 md:gap-12">
          {/* Left Column: Timer Clock + Controls */}
          <div className="flex flex-col items-center justify-center">
            {(() => {
              const fontFamilyCss =
                timerFontFamily === 'mono'
                  ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                  : timerFontFamily === 'serif'
                    ? 'Georgia, Cambria, "Times New Roman", Times, serif'
                    : timerFontFamily === 'retro'
                      ? '"Courier New", Courier, monospace'
                      : undefined;

              const fontWeightClass =
                timerFontFamily === 'serif'
                  ? 'font-bold italic tracking-normal'
                  : timerFontFamily === 'retro'
                    ? 'font-black tracking-widest'
                    : 'font-extrabold tracking-tight';

              const effectiveLayoutStyle = isFocus
                ? timerLayoutStyle
                : (breakTimerLayoutStyle === 'match_focus' ? timerLayoutStyle : (breakTimerLayoutStyle ?? 'wavy_circle'));

              const baseShadow = hasCustomBg
                ? isDark
                  ? '0 4px 24px rgba(0,0,0,0.9)'
                  : '0 2px 16px rgba(255,255,255,0.95)'
                : '';
              const digitShadow = timerDigitGlow
                ? `0 0 28px ${accentColor}${baseShadow ? `, ${baseShadow}` : ''}`
                : baseShadow || undefined;

              const pulseClass =
                timerPulseAnimation && timerState.timerRunning ? 'animate-pulse' : '';

              if (effectiveLayoutStyle === 'cyber_box') {
                return (
                  <div
                    className="w-full max-w-[330px] rounded-[32px] p-7 flex flex-col items-center justify-center shadow-lg border transition-all duration-300"
                    style={{
                      backgroundColor: 'var(--m3-surface-container-low)',
                      borderColor: accentColor,
                      minHeight: 230,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowSessionCount((s) => !s)}
                      className="flex flex-col items-center justify-center select-none cursor-pointer focus:outline-none w-full"
                    >
                      <span
                        className={`${fontWeightClass} tabular-nums leading-none transition-all duration-300 ${pulseClass}`}
                        style={{
                          fontFamily: fontFamilyCss,
                          fontSize: timerState.infiniteFocus
                            ? '4.5rem'
                            : timerState.timeStr.length > 5
                              ? '3.25rem'
                              : '4.5rem',
                          color: 'var(--m3-on-surface)',
                          textShadow: digitShadow,
                        }}
                      >
                        {timerState.timeStr}
                      </span>
                      {showSessionCount && (
                        <span
                          className="mt-3 text-sm font-bold tabular-nums px-3 py-1 rounded-full"
                          style={{
                            backgroundColor: containerColor,
                            color: onContainerColor,
                          }}
                        >
                          {isFocus ? `Session ${timerState.currentFocusCount} / {timerState.totalFocusCount}` : 'Break Time'}
                        </span>
                      )}
                    </button>

                    {!timerState.infiniteFocus && (
                      <div
                        className="w-full h-3 rounded-full overflow-hidden mt-6"
                        style={{ backgroundColor: containerColor }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                            backgroundColor: accentColor,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              if (effectiveLayoutStyle === 'clean_minimal') {
                return (
                  <div className="flex flex-col items-center justify-center py-8 px-4 min-h-[250px] w-full max-w-[340px]">
                    <button
                      type="button"
                      onClick={() => setShowSessionCount((s) => !s)}
                      className="flex flex-col items-center justify-center select-none cursor-pointer focus:outline-none"
                    >
                      <span
                        className={`${fontWeightClass} tabular-nums leading-none transition-all duration-300 ${pulseClass}`}
                        style={{
                          fontFamily: fontFamilyCss,
                          fontSize: timerState.infiniteFocus
                            ? '5.25rem'
                            : timerState.timeStr.length > 5
                              ? '3.75rem'
                              : '5.5rem',
                          color: 'var(--m3-on-surface)',
                          textShadow: digitShadow,
                        }}
                      >
                        {timerState.timeStr}
                      </span>
                      {showSessionCount && (
                        <span
                          className="mt-3 text-base font-bold tabular-nums"
                          style={{ color: 'var(--m3-outline)' }}
                        >
                          {isFocus ? `${timerState.currentFocusCount} / {timerState.totalFocusCount}` : 'Break'}
                        </span>
                      )}
                    </button>
                    {!timerState.infiniteFocus && (
                      <div
                        className="w-48 h-1.5 rounded-full overflow-hidden mt-5 opacity-80"
                        style={{ backgroundColor: containerColor }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
                            backgroundColor: accentColor,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              if (effectiveLayoutStyle === 'pulsing_bubble') {
                return (
                  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                    <div
                      className={`absolute inset-2 rounded-full transition-all duration-1000 ${timerState.timerRunning ? 'animate-pulse' : ''}`}
                      style={{
                        backgroundColor: accentColor,
                        opacity: 0.22,
                        filter: 'blur(22px)',
                        transform: timerState.timerRunning ? 'scale(1.12)' : 'scale(1)',
                      }}
                    />
                    <div
                      className="absolute inset-6 rounded-full flex flex-col items-center justify-center shadow-xl border"
                      style={{
                        backgroundColor: 'var(--m3-surface-container-low)',
                        borderColor: accentColor,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowSessionCount((s) => !s)}
                        className="flex flex-col items-center justify-center select-none cursor-pointer focus:outline-none"
                      >
                        <span
                          className={`${fontWeightClass} tabular-nums leading-none transition-all duration-300 ${pulseClass}`}
                          style={{
                            fontFamily: fontFamilyCss,
                            fontSize: timerState.timeStr.length > 5 ? '3.25rem' : '4.25rem',
                            color: 'var(--m3-on-surface)',
                            textShadow: digitShadow,
                          }}
                        >
                          {timerState.timeStr}
                        </span>
                        {showSessionCount && (
                          <span
                            className="mt-3 text-xs font-bold tabular-nums px-3.5 py-1 rounded-full uppercase tracking-wider"
                            style={{
                              backgroundColor: containerColor,
                              color: onContainerColor,
                            }}
                          >
                            {isFocus ? `Session ${timerState.currentFocusCount}/${timerState.totalFocusCount}` : 'Zen Break'}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              }

              const useWavyRing = effectiveLayoutStyle === 'wavy_circle' && !isFocus;
              const ringStroke = effectiveLayoutStyle === 'minimalist_ring' ? 6 : strokeWidth;

              return (
                <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                  {!timerState.infiniteFocus && (
                    <svg width={size} height={size} className="overflow-visible">
                      {!useWavyRing ? (
                        <>
                          <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={containerColor}
                            strokeWidth={ringStroke}
                            strokeLinecap="round"
                          />
                          <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth={ringStroke}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                            style={{ transition: 'stroke-dashoffset 220ms linear, stroke 300ms ease' }}
                          />
                        </>
                      ) : (
                        <g className={timerState.timerRunning ? 'animate-wave-slow origin-center' : ''}>
                          <path
                            d={wavyPath}
                            fill="none"
                            stroke={containerColor}
                            strokeWidth={ringStroke}
                            strokeLinecap="round"
                          />
                          <path
                            d={wavyPath}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth={ringStroke}
                            strokeLinecap="round"
                            pathLength={100}
                            strokeDasharray="100"
                            strokeDashoffset={100 * (1 - progress)}
                            style={{ transition: 'stroke-dashoffset 220ms linear, stroke 300ms ease' }}
                          />
                        </g>
                      )}
                    </svg>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowSessionCount((s) => !s)}
                    className="absolute inset-8 rounded-full flex flex-col items-center justify-center select-none cursor-pointer focus:outline-none"
                  >
                    <span
                      className={`${fontWeightClass} tabular-nums leading-none transition-all duration-300 ${pulseClass}`}
                      style={{
                        fontFamily: fontFamilyCss,
                        fontSize: timerState.infiniteFocus
                          ? '4.75rem'
                          : timerState.timeStr.length > 5
                            ? '3.25rem'
                            : '4.25rem',
                        color: 'var(--m3-on-surface)',
                        textShadow: digitShadow,
                      }}
                    >
                      {timerState.timeStr}
                    </span>
                    {showSessionCount && (
                      <span
                        className="mt-2 text-lg font-bold tabular-nums"
                        style={{ color: 'var(--m3-outline)' }}
                      >
                        {timerState.currentFocusCount} / {timerState.totalFocusCount}
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}

            <div className="flex items-center justify-center gap-2.5 mt-6">
              <button
                type="button"
                onClick={onToggleTimer}
                aria-label={timerState.timerRunning ? 'Pause' : 'Play'}
                className="h-14 w-24 flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
                style={{
                  backgroundColor: timerState.timerRunning ? accentColor : 'var(--m3-primary-container)',
                  color: timerState.timerRunning ? onAccentColor : 'var(--m3-on-primary-container)',
                  borderRadius: timerState.timerRunning ? '20px' : '9999px',
                }}
              >
                {timerState.timerRunning ? (
                  <Pause size={24} fill="currentColor" />
                ) : (
                  <Play size={24} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset timer"
                className="h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: containerColor,
                  color: onContainerColor,
                }}
              >
                <RotateCcw size={20} />
              </button>

              <button
                type="button"
                onClick={onSkipTimer}
                aria-label="Skip to next interval"
                title="Skip to next interval"
                className="h-14 w-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: containerColor,
                  color: onContainerColor,
                }}
              >
                <SkipForward size={20} />
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenPiP}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--m3-surface-container-high)',
                color: 'var(--m3-on-surface-variant)',
              }}
            >
              <PictureInPicture2 size={14} />
              Mini-Timer
            </button>
          </div>

          {/* Right Column: Up Next, Active Task, Mini-Timer & Focus Tools */}
          <div className="flex flex-col items-center md:items-stretch w-full max-w-md mx-auto space-y-4">
            <div
              className="w-full rounded-[24px] p-5 text-center md:text-left flex items-center justify-between"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m3-outline)' }}>
                  Up next
                </div>
                <div className="text-base font-bold mt-0.5" style={{ color: 'var(--m3-on-surface)' }}>
                  {timerState.nextTimerMode === 'FOCUS'
                    ? 'Focus'
                    : timerState.nextTimerMode === 'SHORT_BREAK'
                      ? 'Short Break'
                      : 'Long Break'}
                </div>
              </div>
              <div
                className="text-3xl font-extrabold tabular-nums"
                style={{
                  color: timerState.nextTimerMode === 'FOCUS' ? 'var(--m3-primary)' : 'var(--m3-tertiary)',
                }}
              >
                {timerState.nextTimeStr}
              </div>
            </div>

            {activeTask && (
              <div
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-[24px] shadow-xs"
                style={{
                  backgroundColor: 'var(--m3-surface-container-high)',
                  color: 'var(--m3-on-surface)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-65">
                    Blitzing task
                  </div>
                  <div className="text-sm font-bold truncate">{activeTask.title}</div>
                </div>
                <button
                  type="button"
                  onClick={onCompleteActiveTask}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer transition-transform active:scale-95"
                  style={{
                    backgroundColor: 'var(--m3-primary)',
                    color: 'var(--m3-on-primary)',
                  }}
                >
                  <CheckCircle2 size={14} />
                  Done
                </button>
              </div>
            )}

            {aodEnabled && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <button
                  type="button"
                  onClick={onEnterAod}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--m3-surface-container-high)',
                    color: 'var(--m3-on-surface-variant)',
                  }}
                >
                  Always-On Display
                </button>
              </div>
            )}

            <div className="w-full flex justify-center md:justify-start">
              <FocusToolsBar onSendNoteToBacklog={onSendNoteToBacklog} />
            </div>
          </div>
        </div>
      </main>

      {snackbar && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold"
          style={{
            backgroundColor: 'var(--m3-on-surface)',
            color: 'var(--m3-surface)',
          }}
        >
          <span>{snackbar.message}</span>
          {snackbar.canUndo && (
            <button
              type="button"
              onClick={() => {
                onUndoReset();
                setSnackbar(null);
              }}
              className="font-bold underline cursor-pointer"
              style={{ color: 'var(--m3-primary-container)' }}
            >
              Undo
            </button>
          )}
        </div>
      )}

    </div>
  );
};

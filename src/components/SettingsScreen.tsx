import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Download,
  Eye,
  HardDrive,
  Hash,
  Image,
  Info,
  Layers,
  Maximize2,
  Palette,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  SunDim,
  Tag,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  COLOR_SCHEMES,
  DEFAULT_TOPIC_ID,
  type SettingsState,
  type SettingsSubScreen,
  type TagItem,
  type Task,
  type ThemeMode,
  type Topic,
} from '../types';
import { alarmPlayer } from '../utils/sound';
import { TopicShapeIcon } from './TopicShapeIcon';
import { GoogleDriveBackupCard } from './GoogleDriveBackupCard';
import { compressImageFile } from '../services/localPersistence';
import type { CelebrationVariant } from './CelebrationModal';

interface SettingsScreenProps {
  settings: SettingsState;
  topics: Topic[];
  tags: TagItem[];
  tasks: Task[];
  subScreen: SettingsSubScreen;
  lastModified?: number;
  isPristine?: boolean;
  onNavigate: (sub: SettingsSubScreen) => void;
  onUpdateSettings: (patch: Partial<SettingsState>) => void;
  onAddTopic: () => void;
  onEditTopic: (topic: Topic) => void;
  onDeleteTopic: (topicId: number) => void;
  onCreateTag: (name: string, color: string) => TagItem;
  onUpdateTag: (tag: TagItem) => void;
  onDeleteTag: (tagId: string) => void;
  onEraseAllData: () => void;
  onExportBackup: () => string;
  onImportBackup: (raw: string) => boolean;
  onPreviewCelebration: (variant: CelebrationVariant) => void;
  onShowToast?: (message: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  topics,
  tags,
  tasks,
  subScreen,
  lastModified,
  isPristine,
  onNavigate,
  onUpdateSettings,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onEraseAllData,
  onExportBackup,
  onImportBackup,
  onPreviewCelebration,
  onShowToast,
}) => {
  const hasCustomBg = Boolean(settings.customBackgroundUrl);
  const [confirmErase, setConfirmErase] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [wallpaperInput, setWallpaperInput] = useState(settings.customBackgroundUrl || '');
  const [previewMode, setPreviewMode] = useState<'focus' | 'break'>('focus');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_SCHEMES[4].color);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState(COLOR_SCHEMES[0].color);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWallpaperInput(settings.customBackgroundUrl || '');
  }, [settings.customBackgroundUrl]);

  const handleDownloadBackup = () => {
    const json = onExportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tomato-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Backup downloaded successfully.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportBackup(String(reader.result ?? ''));
      setBackupMessage(ok ? 'Backup restored successfully.' : 'Invalid backup file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderHeader = (title: string, backTo: SettingsSubScreen = 'main') => (
    <div className="flex items-center gap-3 pb-2">
      <button
        type="button"
        onClick={() => onNavigate(backTo)}
        className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-black/5 cursor-pointer"
        aria-label="Back"
      >
        <ArrowLeft size={22} />
      </button>
      <h1 className="text-2xl font-extrabold">{title}</h1>
    </div>
  );

  // Appearance Hub (zero-scroll categorized menu)
  if (subScreen === 'appearance') {
    const layoutLabels: Record<string, string> = {
      wavy_circle: 'Wavy Expressive',
      minimalist_ring: 'Minimalist Ring',
      cyber_box: 'Cyber Card',
      clean_minimal: 'Clean Minimal',
    };
    const fontLabels: Record<string, string> = {
      jakarta: 'Modern Sans',
      mono: 'Technical Mono',
      serif: 'Editorial Serif',
      retro: 'Retro Display',
    };
    const appearanceCards: {
      route: SettingsSubScreen;
      icon: React.ReactNode;
      title: string;
      subtitle: string;
      badge?: string;
    }[] = [
      {
        route: 'appearance_theme',
        icon: <Palette size={20} />,
        title: 'Theme & Colors',
        subtitle: 'Light/Dark mode, Material accent colors, AMOLED black, AOD',
        badge: settings.theme === 'auto' ? 'System' : settings.theme === 'dark' ? 'Dark' : 'Light',
      },
      {
        route: 'appearance_timer',
        icon: <Clock size={20} />,
        title: 'Timer Display & Style',
        subtitle: 'Visual layout, clock font family, pulse animation & live preview',
        badge: `${layoutLabels[settings.timerLayoutStyle ?? 'wavy_circle']} · ${fontLabels[settings.timerFontFamily ?? 'jakarta']}`,
      },
      {
        route: 'appearance_wallpaper',
        icon: <Image size={20} />,
        title: 'Workspace Wallpaper',
        subtitle: 'Custom images/GIFs, opacity, dimming, blur, frosted glass & vignette',
        badge: settings.customBackgroundUrl ? 'Active' : 'None',
      },
    ];

    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Appearance', 'main')}

          <div className="space-y-1.5">
            {appearanceCards.map((card, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === appearanceCards.length - 1;
              const radiusClass = isFirst
                ? 'rounded-t-[24px] rounded-b-[8px]'
                : isLast
                  ? 'rounded-t-[8px] rounded-b-[24px]'
                  : 'rounded-[8px]';
              return (
                <button
                  key={card.route}
                  type="button"
                  onClick={() => onNavigate(card.route)}
                  className={`w-full flex items-center justify-between gap-3 p-5 ${radiusClass} cursor-pointer transition-transform active:scale-[0.99] text-left`}
                  style={{ backgroundColor: 'var(--m3-surface-bright)' }}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: 'var(--m3-primary-container)',
                        color: 'var(--m3-on-primary-container)',
                      }}
                    >
                      {card.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-base flex items-center gap-2 flex-wrap">
                        <span>{card.title}</span>
                        {card.badge && (
                          <span
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: 'var(--m3-surface-container-high)',
                              color: 'var(--m3-on-surface-variant)',
                            }}
                          >
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        {card.subtitle}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} style={{ color: 'var(--m3-outline)' }} className="shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Appearance -> Theme & Colors
  if (subScreen === 'appearance_theme') {
    const themes: { id: ThemeMode; label: string }[] = [
      { id: 'auto', label: 'System' },
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
    ];
    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Theme & Colors', 'appearance')}

          <div className="rounded-[24px] p-5 space-y-3" style={{ backgroundColor: 'var(--m3-surface-bright)' }}>
            <div className="text-sm font-bold">Theme</div>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => {
                const selected = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: t.id })}
                    className="py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: selected ? 'var(--m3-primary)' : 'var(--m3-surface-container-high)',
                      color: selected ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] p-5 space-y-3" style={{ backgroundColor: 'var(--m3-surface-bright)' }}>
            <div className="text-sm font-bold">Color scheme</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ colorScheme: '#ffffff' })}
                className="h-9 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                style={{
                  backgroundColor:
                    settings.colorScheme === '#ffffff'
                      ? 'var(--m3-primary)'
                      : 'var(--m3-secondary-container)',
                  color:
                    settings.colorScheme === '#ffffff'
                      ? 'var(--m3-on-primary)'
                      : 'var(--m3-on-secondary-container)',
                }}
              >
                {settings.colorScheme === '#ffffff' && <Check size={14} />}
                Default
              </button>
              {COLOR_SCHEMES.map((item) => {
                const selected = settings.colorScheme.toLowerCase() === item.color.toLowerCase();
                return (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => onUpdateSettings({ colorScheme: item.color })}
                    title={item.name}
                    className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: selected
                        ? '0 0 0 2px var(--m3-surface), 0 0 0 4px var(--m3-primary)'
                        : 'none',
                    }}
                  >
                    {selected && <Check size={16} color="#1a1c16" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="flex items-center justify-between p-5 rounded-t-[24px] rounded-b-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Black theme (AMOLED)</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Pure black background in dark mode
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.blackTheme}
                onChange={(e) => onUpdateSettings({ blackTheme: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>
            <label
              className="flex items-center justify-between p-5 rounded-t-[6px] rounded-b-[24px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Always-On Display</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Enable minimalist full-screen dark clock mode
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.aodEnabled}
                onChange={(e) => onUpdateSettings({ aodEnabled: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // Appearance -> Timer Display & Style
  if (subScreen === 'appearance_timer') {
    const activeLayout = settings.timerLayoutStyle ?? 'wavy_circle';
    const breakLayout = settings.breakTimerLayoutStyle ?? 'wavy_circle';
    const activeFont = settings.timerFontFamily ?? 'jakarta';
    const activePulse = settings.timerPulseAnimation ?? true;
    const digitGlow = settings.timerDigitGlow ?? false;

    const previewFontCss =
      activeFont === 'mono'
        ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        : activeFont === 'serif'
          ? 'Georgia, Cambria, "Times New Roman", Times, serif'
          : activeFont === 'retro'
            ? '"Courier New", Courier, monospace'
            : undefined;

    const previewWeightClass =
      activeFont === 'serif'
        ? 'font-bold italic tracking-normal'
        : activeFont === 'retro'
          ? 'font-black tracking-widest'
          : 'font-extrabold tracking-tight';

    const currentLayoutToPreview = previewMode === 'focus' ? activeLayout : (breakLayout === 'match_focus' ? activeLayout : breakLayout);
    const previewTimeStr = previewMode === 'focus' ? '25:00' : '05:00';
    const previewLabel = previewMode === 'focus' ? 'Focus Mode' : 'Zen Break';

    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Timer Display & Style', 'appearance')}

          {/* Live Preview */}
          <div
            className="rounded-[24px] p-6 flex flex-col items-center justify-center space-y-3"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m3-outline)' }}>
                Live Clock Preview
              </span>
              <div className="flex bg-black/10 dark:bg-white/10 p-1 rounded-full text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewMode('focus')}
                  className={`px-3 py-1 rounded-full cursor-pointer transition-colors ${previewMode === 'focus' ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)]' : 'opacity-70'}`}
                >
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('break')}
                  className={`px-3 py-1 rounded-full cursor-pointer transition-colors ${previewMode === 'break' ? 'bg-[var(--m3-tertiary)] text-[var(--m3-on-tertiary)]' : 'opacity-70'}`}
                >
                  Break
                </button>
              </div>
            </div>

            {currentLayoutToPreview === 'cyber_box' ? (
              <div
                className="w-60 rounded-[24px] p-5 flex flex-col items-center border"
                style={{
                  backgroundColor: 'var(--m3-surface-container-low)',
                  borderColor: previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)',
                }}
              >
                <span
                  className={`text-5xl tabular-nums leading-none ${previewWeightClass} ${activePulse ? 'animate-pulse' : ''}`}
                  style={{
                    fontFamily: previewFontCss,
                    textShadow: digitGlow ? `0 0 24px ${previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)'}` : 'none',
                  }}
                >
                  {previewTimeStr}
                </span>
                <span className="mt-2 text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--m3-secondary-container)' }}>
                  {previewLabel}
                </span>
              </div>
            ) : currentLayoutToPreview === 'clean_minimal' ? (
              <div className="py-4 flex flex-col items-center">
                <span
                  className={`text-6xl tabular-nums leading-none ${previewWeightClass} ${activePulse ? 'animate-pulse' : ''}`}
                  style={{
                    fontFamily: previewFontCss,
                    textShadow: digitGlow ? `0 0 28px ${previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)'}` : 'none',
                  }}
                >
                  {previewTimeStr}
                </span>
                <span className="mt-2 text-xs font-semibold opacity-70">{previewLabel}</span>
              </div>
            ) : currentLayoutToPreview === 'wavy_circle' && previewMode === 'break' ? (
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg width="144" height="144" className="absolute inset-0 overflow-visible animate-wave-slow origin-center">
                  <path
                    d="M 72 12 C 90 12, 108 24, 118 42 C 128 60, 132 84, 118 102 C 104 120, 84 132, 72 132 C 60 132, 40 120, 26 102 C 12 84, 16 60, 26 42 C 36 24, 54 12, 72 12 Z"
                    fill="none"
                    stroke="var(--m3-tertiary-container)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 72 12 C 90 12, 108 24, 118 42 C 128 60, 132 84, 118 102 C 104 120, 84 132, 72 132 C 60 132, 40 120, 26 102 C 12 84, 16 60, 26 42 C 36 24, 54 12, 72 12 Z"
                    fill="none"
                    stroke="var(--m3-tertiary)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="100"
                    strokeDashoffset="25"
                  />
                </svg>
                <div className="flex flex-col items-center justify-center z-10">
                  <span
                    className={`text-2xl tabular-nums leading-none ${previewWeightClass} ${activePulse ? 'animate-pulse' : ''}`}
                    style={{
                      fontFamily: previewFontCss,
                      textShadow: digitGlow ? '0 0 20px var(--m3-tertiary)' : 'none',
                    }}
                  >
                    {previewTimeStr}
                  </span>
                  <span className="text-[10px] font-bold mt-1" style={{ color: 'var(--m3-outline)' }}>
                    {previewLabel}
                  </span>
                </div>
              </div>
            ) : currentLayoutToPreview === 'pulsing_bubble' ? (
              <div className="relative w-36 h-36 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full animate-pulse"
                  style={{
                    backgroundColor: previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)',
                    opacity: 0.25,
                    filter: 'blur(16px)',
                  }}
                />
                <div
                  className="absolute inset-2 rounded-full flex flex-col items-center justify-center border shadow-md"
                  style={{
                    backgroundColor: 'var(--m3-surface-container-low)',
                    borderColor: previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)',
                  }}
                >
                  <span
                    className={`text-2xl tabular-nums leading-none ${previewWeightClass}`}
                    style={{
                      fontFamily: previewFontCss,
                      textShadow: digitGlow ? `0 0 20px ${previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)'}` : 'none',
                    }}
                  >
                    {previewTimeStr}
                  </span>
                  <span className="text-[10px] font-bold mt-1 uppercase" style={{ color: 'var(--m3-outline)' }}>
                    {previewLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="w-36 h-36 rounded-full flex flex-col items-center justify-center"
                style={{
                  border: `${currentLayoutToPreview === 'minimalist_ring' ? '4px' : '9px'} solid ${previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)'}`,
                }}
              >
                <span
                  className={`text-3xl tabular-nums leading-none ${previewWeightClass} ${activePulse ? 'animate-pulse' : ''}`}
                  style={{
                    fontFamily: previewFontCss,
                    textShadow: digitGlow ? `0 0 20px ${previewMode === 'focus' ? 'var(--m3-primary)' : 'var(--m3-tertiary)'}` : 'none',
                  }}
                >
                  {previewTimeStr}
                </span>
                <span className="text-[11px] font-bold mt-1" style={{ color: 'var(--m3-outline)' }}>
                  {previewLabel}
                </span>
              </div>
            )}
          </div>

          {/* Focus Visual Layout */}
          <div className="rounded-[24px] p-5 space-y-3" style={{ backgroundColor: 'var(--m3-surface-bright)' }}>
            <div className="text-sm font-bold">Focus Timer Visual Layout</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'wavy_circle' as const, label: 'Wavy Expressive', desc: 'Bold M3 ring' },
                { id: 'minimalist_ring' as const, label: 'Minimalist Ring', desc: 'Sleek ultra-thin ring' },
                { id: 'cyber_box' as const, label: 'Cyber Card', desc: 'Framed card + progress' },
                { id: 'clean_minimal' as const, label: 'Clean Minimal', desc: 'Oversized digits' },
              ].map((opt) => {
                const selected = activeLayout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ timerLayoutStyle: opt.id })}
                    className="p-3.5 rounded-2xl text-left cursor-pointer transition-all hover:scale-[1.01]"
                    style={{
                      backgroundColor: selected ? 'var(--m3-primary)' : 'var(--m3-surface-container-low)',
                      color: selected ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                    }}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>{opt.label}</span>
                      {selected && <Check size={14} />}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Break Timer Visual Layout (Customizable Break Clock Style!) */}
          <div className="rounded-[24px] p-5 space-y-3" style={{ backgroundColor: 'var(--m3-surface-bright)' }}>
            <div>
              <div className="text-sm font-bold">Break Timer Clock Style</div>
              <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Customize how the clock looks during short & long breaks
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'match_focus' as const, label: 'Match Focus', desc: 'Same as focus' },
                { id: 'wavy_circle' as const, label: 'Wavy Zen Ring', desc: 'Animated wavy ring' },
                { id: 'pulsing_bubble' as const, label: 'Pulsing Bubble', desc: 'Soothing breathing' },
                { id: 'minimalist_ring' as const, label: 'Minimalist Ring', desc: 'Thin ring' },
                { id: 'cyber_box' as const, label: 'Cyber Card', desc: 'Framed card' },
                { id: 'clean_minimal' as const, label: 'Clean Minimal', desc: 'Oversized digits' },
              ].map((opt) => {
                const selected = breakLayout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ breakTimerLayoutStyle: opt.id })}
                    className="p-3.5 rounded-2xl text-left cursor-pointer transition-all hover:scale-[1.01]"
                    style={{
                      backgroundColor: selected ? 'var(--m3-tertiary)' : 'var(--m3-surface-container-low)',
                      color: selected ? 'var(--m3-on-tertiary)' : 'var(--m3-on-surface)',
                    }}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>{opt.label}</span>
                      {selected && <Check size={14} />}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clock Font Style */}
          <div className="rounded-[24px] p-5 space-y-3" style={{ backgroundColor: 'var(--m3-surface-bright)' }}>
            <div className="text-sm font-bold">Clock Font Style</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'jakarta' as const, label: 'Modern Sans', sample: '25:00', fontCss: undefined },
                { id: 'mono' as const, label: 'Technical Mono', sample: '25:00', fontCss: 'ui-monospace, monospace' },
                { id: 'serif' as const, label: 'Editorial Serif', sample: '25:00', fontCss: 'Georgia, serif' },
                { id: 'retro' as const, label: 'Retro Display', sample: '25:00', fontCss: '"Courier New", monospace' },
              ].map((opt) => {
                const selected = activeFont === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ timerFontFamily: opt.id })}
                    className="p-3.5 rounded-2xl text-left cursor-pointer transition-all hover:scale-[1.01]"
                    style={{
                      backgroundColor: selected ? 'var(--m3-primary)' : 'var(--m3-surface-container-low)',
                      color: selected ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                    }}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>{opt.label}</span>
                      {selected && <Check size={14} />}
                    </div>
                    <div
                      className="text-2xl font-extrabold mt-1 tabular-nums"
                      style={{ fontFamily: opt.fontCss }}
                    >
                      {opt.sample}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles: Breathing Pulse & Neon Digit Glow */}
          <div className="space-y-1">
            <label
              className="flex items-center justify-between p-5 rounded-t-[24px] rounded-b-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Active Breathing Pulse</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Subtle pulse on timer digits while running
                </div>
              </div>
              <input
                type="checkbox"
                checked={activePulse}
                onChange={(e) => onUpdateSettings({ timerPulseAnimation: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>
            <label
              className="flex items-center justify-between p-5 rounded-t-[6px] rounded-b-[24px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Neon Digit Glow</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Adds a glowing accent shadow halo to timer digits
                </div>
              </div>
              <input
                type="checkbox"
                checked={digitGlow}
                onChange={(e) => onUpdateSettings({ timerDigitGlow: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // Appearance -> Workspace Wallpaper
  if (subScreen === 'appearance_wallpaper') {
    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Workspace Wallpaper', 'appearance')}

          <div
            className="rounded-[24px] p-5 space-y-3.5"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base">Workspace Wallpaper</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Set a custom background image or animated GIF
                </div>
              </div>
              {settings.customBackgroundUrl && (
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ customBackgroundUrl: '' })}
                  className="text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--m3-error-container)',
                    color: 'var(--m3-on-error-container)',
                  }}
                >
                  Remove wallpaper
                </button>
              )}
            </div>

            {/* Active Wallpaper Live Thumbnail Preview with Simulated Clock */}
            {settings.customBackgroundUrl && (
              <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/20 shadow-md">
                {/* Simulated live wallpaper with active blur, opacity, and fit */}
                <div
                  className="absolute inset-0 transition-all duration-200"
                  style={{
                    backgroundImage: `url("${settings.customBackgroundUrl}")`,
                    backgroundPosition: 'center',
                    backgroundSize:
                      (settings.wallpaperFit ?? 'cover') === 'tile'
                        ? 'auto'
                        : (settings.wallpaperFit ?? 'cover'),
                    backgroundRepeat:
                      (settings.wallpaperFit ?? 'cover') === 'tile' ? 'repeat' : 'no-repeat',
                    opacity: (settings.wallpaperOpacity ?? 100) / 100,
                    filter:
                      (settings.wallpaperBlur ?? 0) > 0 ? `blur(${settings.wallpaperBlur}px)` : 'none',
                    transform: (settings.wallpaperBlur ?? 0) > 0 ? 'scale(1.12)' : 'none',
                  }}
                />
                {/* Simulated overlay dimming */}
                <div
                  className="absolute inset-0 transition-colors duration-200"
                  style={{
                    backgroundColor: `rgba(0, 0, 0, ${(settings.wallpaperDim ?? 40) / 100})`,
                  }}
                />
                {/* Simulated vignette if enabled */}
                {settings.wallpaperVignette && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
                    }}
                  />
                )}
                {/* Live mini sample clock & card badge */}
                <div className="absolute inset-0 flex flex-col justify-between p-3.5 text-white z-10 pointer-events-none select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-black/45 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold border border-white/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live Wallpaper Preview
                    </div>
                    <span className="text-[11px] font-mono bg-black/45 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 opacity-90">
                      {settings.wallpaperOpacity ?? 100}% opac · {settings.wallpaperDim ?? 40}% dim
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold tracking-tight tabular-nums drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                        25:00
                      </span>
                      <span className="text-xs font-semibold opacity-90 drop-shadow">
                        Focus Mode
                      </span>
                    </div>
                    {settings.wallpaperGlassCards && (
                      <span className="text-[10px] font-semibold bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/25">
                        Frosted Glass
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs font-bold" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Curated Presets
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: '🔥 Fireplace GIF', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
                { label: '🌧️ Rain & City GIF', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
                { label: '🐱 Vibing Cat GIF', url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif' },
                { label: '✨ Starry Sky', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80' },
                { label: '💧 Rainy Window', url: 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1200&q=80' },
                { label: '🌆 Cyberpunk City', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80' },
              ].map((p) => {
                const active = settings.customBackgroundUrl === p.url;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ customBackgroundUrl: p.url });
                      setWallpaperInput(p.url);
                    }}
                    className="py-2.5 px-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer text-center truncate flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: active ? 'var(--m3-primary)' : 'var(--m3-surface-container-high)',
                      color: active ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                    }}
                  >
                    <span>{p.label}</span>
                    {active && <Check size={13} />}
                  </button>
                );
              })}
            </div>

            <div className="text-xs font-bold pt-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Or Custom Image / GIF Link
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste any image or GIF URL…"
                value={wallpaperInput}
                onChange={(e) => setWallpaperInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateSettings({ customBackgroundUrl: wallpaperInput.trim() });
                  }
                }}
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-full text-xs outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface-container-low)',
                  color: 'var(--m3-on-surface)',
                }}
              />
              <button
                type="button"
                onClick={() => onUpdateSettings({ customBackgroundUrl: wallpaperInput.trim() })}
                className="px-4 py-2.5 rounded-full text-xs font-bold cursor-pointer transition-opacity hover:opacity-90 shrink-0"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                Apply
              </button>
              <label
                className="px-4 py-2.5 rounded-full text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shrink-0 transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--m3-secondary-container)',
                  color: 'var(--m3-on-secondary-container)',
                }}
              >
                <Upload size={14} />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void compressImageFile(file).then((compressedUrl) => {
                      if (compressedUrl) {
                        onUpdateSettings({ customBackgroundUrl: compressedUrl });
                        setWallpaperInput(compressedUrl);
                      }
                    });
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Visual Tuning Controls (Shown when wallpaper is active) */}
            {settings.customBackgroundUrl && (
              <div className="mt-4 pt-4 border-t border-[var(--m3-outline-variant)]/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} style={{ color: 'var(--m3-primary)' }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m3-on-surface)' }}>
                      Visual Tuning & Effects
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        wallpaperOpacity: 100,
                        wallpaperDim: 40,
                        wallpaperBlur: 0,
                        wallpaperFit: 'cover',
                        wallpaperGlassCards: true,
                        wallpaperVignette: false,
                      })
                    }
                    className="text-[11px] font-semibold opacity-70 hover:opacity-100 cursor-pointer transition-opacity underline"
                  >
                    Reset tuning
                  </button>
                </div>

                {/* Quick Moods */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Quick Mood Presets
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: '🌟 Balanced', opacity: 100, dim: 40, blur: 0, glass: true, vignette: false },
                      { label: '🌌 Soft Bokeh', opacity: 85, dim: 45, blur: 10, glass: true, vignette: false },
                      { label: '🕶️ Stealth', opacity: 70, dim: 70, blur: 4, glass: false, vignette: true },
                      { label: '⚡ Vibrant', opacity: 100, dim: 20, blur: 0, glass: true, vignette: false },
                    ].map((mood) => {
                      const isCurrent =
                        (settings.wallpaperOpacity ?? 100) === mood.opacity &&
                        (settings.wallpaperDim ?? 40) === mood.dim &&
                        (settings.wallpaperBlur ?? 0) === mood.blur &&
                        Boolean(settings.wallpaperVignette) === mood.vignette;
                      return (
                        <button
                          key={mood.label}
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              wallpaperOpacity: mood.opacity,
                              wallpaperDim: mood.dim,
                              wallpaperBlur: mood.blur,
                              wallpaperGlassCards: mood.glass,
                              wallpaperVignette: mood.vignette,
                            })
                          }
                          className="py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all hover:scale-105 cursor-pointer text-center truncate"
                          style={{
                            backgroundColor: isCurrent ? 'var(--m3-primary)' : 'var(--m3-surface-container)',
                            color: isCurrent ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                          }}
                        >
                          {mood.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sliders Grid: Opacity, Dimming, Blur */}
                <div
                  className="space-y-3.5 p-4 rounded-2xl"
                  style={{ backgroundColor: 'var(--m3-surface-container)' }}
                >
                  {/* Wallpaper Opacity */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Eye size={14} style={{ color: 'var(--m3-primary)' }} />
                        Wallpaper Transparency / Opacity
                      </span>
                      <span className="font-bold tabular-nums">{settings.wallpaperOpacity ?? 100}%</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={100}
                      step={5}
                      value={settings.wallpaperOpacity ?? 100}
                      onChange={(e) => onUpdateSettings({ wallpaperOpacity: Number(e.target.value) })}
                      className="w-full h-2 rounded-lg accent-[var(--m3-primary)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] opacity-60 mt-0.5">
                      <span>Faint / Subtle (15%)</span>
                      <span>Full Solid (100%)</span>
                    </div>
                  </div>

                  {/* Overlay Dimming */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5">
                        <SunDim size={14} style={{ color: 'var(--m3-primary)' }} />
                        Contrast Tint & Dimming
                      </span>
                      <span className="font-bold tabular-nums">{settings.wallpaperDim ?? 40}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={settings.wallpaperDim ?? 40}
                      onChange={(e) => onUpdateSettings({ wallpaperDim: Number(e.target.value) })}
                      className="w-full h-2 rounded-lg accent-[var(--m3-primary)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] opacity-60 mt-0.5">
                      <span>No Dimming (0%)</span>
                      <span>Heavy Tint (90%)</span>
                    </div>
                  </div>

                  {/* Background Blur */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={14} style={{ color: 'var(--m3-primary)' }} />
                        Background Blur
                      </span>
                      <span className="font-bold tabular-nums">{settings.wallpaperBlur ?? 0}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={2}
                      value={settings.wallpaperBlur ?? 0}
                      onChange={(e) => onUpdateSettings({ wallpaperBlur: Number(e.target.value) })}
                      className="w-full h-2 rounded-lg accent-[var(--m3-primary)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] opacity-60 mt-0.5">
                      <span>Sharp & Crisp (0px)</span>
                      <span>Dreamy Bokeh (20px)</span>
                    </div>
                  </div>
                </div>

                {/* Sizing & Repeat Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Display Fit / Sizing
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cover' as const, label: 'Cover (Full)', desc: 'Fills screen' },
                      { id: 'contain' as const, label: 'Contain (Fit)', desc: 'No crop' },
                      { id: 'tile' as const, label: 'Tile (Pattern)', desc: 'Repeats pattern' },
                    ].map((mode) => {
                      const active = (settings.wallpaperFit ?? 'cover') === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => onUpdateSettings({ wallpaperFit: mode.id })}
                          className="py-2 px-2 rounded-xl text-center cursor-pointer transition-all hover:scale-[1.02]"
                          style={{
                            backgroundColor: active ? 'var(--m3-primary)' : 'var(--m3-surface-container)',
                            color: active ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                          }}
                        >
                          <div className="text-xs font-bold">{mode.label}</div>
                          <div className="text-[10px] opacity-75">{mode.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toggles: Frosted Glass Cards & Cinematic Vignette */}
                <div className="space-y-2 pt-1">
                  <label
                    className="flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-colors"
                    style={{ backgroundColor: 'var(--m3-surface-container)' }}
                  >
                    <div className="pr-3">
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <Layers size={14} style={{ color: 'var(--m3-primary)' }} />
                        Frosted Glass Cards (Glassmorphism)
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        Makes timer & task panels translucent with backdrop blur
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.wallpaperGlassCards ?? true}
                      onChange={(e) => onUpdateSettings({ wallpaperGlassCards: e.target.checked })}
                      className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer shrink-0"
                    />
                  </label>

                  <label
                    className="flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-colors"
                    style={{ backgroundColor: 'var(--m3-surface-container)' }}
                  >
                    <div className="pr-3">
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <Maximize2 size={14} style={{ color: 'var(--m3-primary)' }} />
                        Cinematic Edge Vignette
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        Subtle dark radial gradient along viewport edges
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.wallpaperVignette ?? false}
                      onChange={(e) => onUpdateSettings({ wallpaperVignette: e.target.checked })}
                      className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer shrink-0"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (subScreen === 'timer') {
    const goalHours = Math.floor(settings.focusGoal / 3600000);
    const goalMins = Math.floor((settings.focusGoal % 3600000) / 60000);

    const setGoal = (h: number, m: number) => {
      onUpdateSettings({ focusGoal: Math.max(0, h) * 3600000 + Math.max(0, m) * 60000 });
    };

    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Timer')}
          <div className="rounded-[24px] p-5 space-y-4" style={{ backgroundColor: 'var(--m3-surface-bright)' }}>
            <div>
              <div className="font-semibold">Daily focus goal</div>
              <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Shown as a target line on your stats charts (0 to disable)
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Hours
                </label>
                <input
                  type="number"
                  min={0}
                  max={16}
                  value={goalHours}
                  onChange={(e) => setGoal(Number(e.target.value), goalMins)}
                  className="w-full px-3 py-2.5 rounded-2xl text-center font-bold tabular-nums outline-none"
                  style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Minutes
                </label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={goalMins}
                  onChange={(e) => setGoal(goalHours, Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-2xl text-center font-bold tabular-nums outline-none"
                  style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subScreen === 'alarm') {
    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Alarm')}
          <div className="space-y-1">
            <label
              className="flex items-center justify-between p-5 rounded-t-[24px] rounded-b-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Alarm sound</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Play chime when focus or break ends
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.alarmEnabled}
                onChange={(e) => onUpdateSettings({ alarmEnabled: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>
            <label
              className="flex items-center justify-between p-5 rounded-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Vibrate</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Vibrate device on supported browsers
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.vibrateEnabled}
                onChange={(e) => onUpdateSettings({ vibrateEnabled: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>
            <button
              type="button"
              onClick={() => alarmPlayer.playPreview()}
              className="w-full flex items-center justify-between p-5 rounded-t-[6px] rounded-b-[24px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div className="flex items-center gap-3">
                <Volume2 size={20} style={{ color: 'var(--m3-primary)' }} />
                <span className="font-semibold">Test alarm chime</span>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--m3-outline)' }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subScreen === 'topics') {
    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          <div className="flex items-center justify-between">
            {renderHeader('Topics')}
            <button
              type="button"
              onClick={onAddTopic}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              <Plus size={18} />
              New
            </button>
          </div>

          <div className="space-y-1">
            {topics.map((topic, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === topics.length - 1;
              const radiusClass =
                isFirst && isLast
                  ? 'rounded-[24px]'
                  : isFirst
                    ? 'rounded-t-[24px] rounded-b-[6px]'
                    : isLast
                      ? 'rounded-t-[6px] rounded-b-[24px]'
                      : 'rounded-[6px]';

              return (
                <div
                  key={topic.id}
                  className={`flex items-center justify-between p-4 ${radiusClass}`}
                  style={{ backgroundColor: 'var(--m3-surface-bright)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TopicShapeIcon shape={topic.shape} color={topic.color} size={26} />
                    <div className="min-w-0">
                      <div className="font-bold truncate">{topic.name}</div>
                      <div className="text-xs tabular-nums" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        {Math.round(topic.focusTime / 60000)}m focus · {Math.round(topic.shortBreakTime / 60000)}m short · {Math.round(topic.longBreakTime / 60000)}m long · {topic.sessionLength}x
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditTopic(topic)}
                      className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                      aria-label={`Edit ${topic.name}`}
                    >
                      <Pencil size={18} />
                    </button>
                    {topic.id !== DEFAULT_TOPIC_ID && (
                      <button
                        type="button"
                        onClick={() => onDeleteTopic(topic.id)}
                        className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                        style={{ color: 'var(--m3-error)' }}
                        aria-label={`Delete ${topic.name}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (subScreen === 'backup') {
    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Backup & restore')}
          <GoogleDriveBackupCard
            autoSync={settings.autoDriveSync}
            lastSyncedAt={settings.lastSyncedAt}
            lastModified={lastModified}
            isPristine={isPristine}
            onToggleAutoSync={(enabled) => onUpdateSettings({ autoDriveSync: enabled })}
            onSynced={(timestampIso) => onUpdateSettings({ lastSyncedAt: timestampIso })}
            onExportBackup={onExportBackup}
            onImportBackup={onImportBackup}
            onShowToast={onShowToast}
          />
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full flex items-center justify-between p-5 rounded-t-[24px] rounded-b-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div className="flex items-center gap-3 text-left">
                <Download size={20} style={{ color: 'var(--m3-primary)' }} />
                <div>
                  <div className="font-semibold">Backup data</div>
                  <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Export topics, stats, and settings as JSON
                  </div>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--m3-outline)' }} />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-between p-5 rounded-t-[6px] rounded-b-[24px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div className="flex items-center gap-3 text-left">
                <Upload size={20} style={{ color: 'var(--m3-primary)' }} />
                <div>
                  <div className="font-semibold">Restore data</div>
                  <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Import a previously exported JSON backup
                  </div>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--m3-outline)' }} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          {backupMessage && (
            <div
              className="p-4 rounded-2xl text-sm font-semibold"
              style={{
                backgroundColor: 'var(--m3-primary-container)',
                color: 'var(--m3-on-primary-container)',
              }}
            >
              {backupMessage}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (subScreen === 'about') {
    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('About')}
          <div className="rounded-[24px] p-6 space-y-3" style={{ backgroundColor: 'var(--m3-surface-bright)' }}>
            <h2 className="text-2xl font-extrabold" style={{ color: 'var(--m3-error)' }}>
              Tomato
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Minimalist, data-oriented Pomodoro timer based on Material 3 Expressive guidelines.
              Track focus sessions across custom topics, review daily, weekly, monthly, and yearly
              statistics, and customize your timer workflow.
            </p>
            <div className="pt-2 text-xs font-semibold" style={{ color: 'var(--m3-outline)' }}>
              Version 2.0.0 · GNU GPLv3 License
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subScreen === 'advanced') {
    const handleToggleNotifications = async (checked: boolean) => {
      if (checked && typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            onUpdateSettings({ desktopNotifications: false });
            return;
          }
        } else if (Notification.permission === 'denied') {
          onUpdateSettings({ desktopNotifications: false });
          return;
        }
      }
      onUpdateSettings({ desktopNotifications: checked });
    };

    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Advanced')}
          <div className="space-y-1">
            <label
              className="flex items-center justify-between p-5 rounded-t-[24px] rounded-b-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Desktop notifications</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Show a system notification when a focus or break interval ends
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.desktopNotifications}
                onChange={(e) => void handleToggleNotifications(e.target.checked)}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>

            <div
              className="p-5 rounded-[6px] space-y-3"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold">Productive hours goal reminder</div>
                  <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Send a daily desktop notification to set your focus goal when your productive hours start
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.productiveHoursReminderEnabled}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    if (checked && typeof Notification !== 'undefined') {
                      if (Notification.permission === 'default') {
                        const perm = await Notification.requestPermission();
                        if (perm !== 'granted') {
                          onUpdateSettings({ productiveHoursReminderEnabled: false });
                          return;
                        }
                      } else if (Notification.permission === 'denied') {
                        onUpdateSettings({ productiveHoursReminderEnabled: false });
                        return;
                      }
                    }
                    onUpdateSettings({ productiveHoursReminderEnabled: checked });
                  }}
                  className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
                />
              </label>

              {settings.productiveHoursReminderEnabled && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Start of productive hours
                  </span>
                  <input
                    type="time"
                    value={settings.productiveHoursStart}
                    onChange={(e) => onUpdateSettings({ productiveHoursStart: e.target.value || '09:00' })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    style={{
                      backgroundColor: 'var(--m3-surface-container-low)',
                      color: 'var(--m3-on-surface)',
                    }}
                  />
                </div>
              )}
            </div>

            <label
              className="flex items-center justify-between p-5 rounded-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Keyboard shortcuts</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Space: Play/Pause · R: Reset · S: Skip next
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.keyboardShortcuts}
                onChange={(e) => onUpdateSettings({ keyboardShortcuts: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>

            <label
              className="flex items-center justify-between p-5 rounded-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Keep screen awake</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Prevent display sleep while the timer is running
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.keepScreenAwake}
                onChange={(e) => onUpdateSettings({ keepScreenAwake: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>

            <label
              className="flex items-center justify-between p-5 rounded-[6px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Celebration memes & GIFs</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Show a fresh celebratory meme or GIF with confetti when completing tasks
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.celebrationsEnabled}
                onChange={(e) => onUpdateSettings({ celebrationsEnabled: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>

            <label
              className="flex items-center justify-between p-5 rounded-t-[6px] rounded-b-[24px] cursor-pointer"
              style={{ backgroundColor: 'var(--m3-surface-bright)' }}
            >
              <div>
                <div className="font-semibold">Single progress bar</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Use a single continuous progress ring style
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.singleProgressBar}
                onChange={(e) => onUpdateSettings({ singleProgressBar: e.target.checked })}
                className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
              />
            </label>
          </div>

          {/* Preview Celebrations */}
          <div
            className="rounded-[24px] p-5 space-y-3"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div>
              <div className="font-semibold">Preview celebration popups</div>
              <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Test your GIF + Meme popups anytime
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: 'task', label: 'Task Done' },
                  { v: 'focus_complete', label: 'Focus Complete' },
                  { v: 'break_complete', label: 'Break Over' },
                  { v: 'daily_goal', label: 'Daily Goal (Cats)' },
                ] as { v: CelebrationVariant; label: string }[]
              ).map((item) => (
                <button
                  key={item.v}
                  type="button"
                  onClick={() => onPreviewCelebration(item.v)}
                  className="py-2.5 px-3 rounded-2xl text-xs font-bold cursor-pointer transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--m3-secondary-container)',
                    color: 'var(--m3-on-secondary-container)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subScreen === 'tags') {
    const handleCreate = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newTagName.trim().replace(/^#+/, '');
      if (!trimmed) return;
      onCreateTag(trimmed, newTagColor);
      setNewTagName('');
      setNewTagColor(COLOR_SCHEMES[(tags.length + 1) % COLOR_SCHEMES.length].color);
    };

    return (
      <div
        className="min-h-screen pb-28 px-4"
        style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}
      >
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Tags', 'main')}

          {/* Create Tag Card */}
          <form
            onSubmit={handleCreate}
            className="rounded-[24px] p-5 space-y-3.5"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div>
              <div className="font-bold text-sm">Create a new tag</div>
              <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Use tags alongside topics (e.g. #h1, #bugcrowd, #pentest) to group tasks and sessions.
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name (e.g. h1, bugcrowd)..."
                className="flex-1 min-w-0 px-4 py-2.5 rounded-full text-sm font-medium outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface-container-low)',
                  color: 'var(--m3-on-surface)',
                }}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer shrink-0 transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                <Plus size={15} />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-0.5">
              {COLOR_SCHEMES.map((item) => {
                const selected = newTagColor.toLowerCase() === item.color.toLowerCase();
                return (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => setNewTagColor(item.color)}
                    title={item.name}
                    className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: selected
                        ? '0 0 0 2px var(--m3-surface), 0 0 0 4px var(--m3-primary)'
                        : 'none',
                    }}
                  >
                    {selected && <Check size={13} color="#1a1c16" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </form>

          {/* Existing Tags List */}
          {tags.length === 0 ? (
            <div
              className="rounded-[24px] p-8 text-center text-sm font-medium"
              style={{
                backgroundColor: 'var(--m3-surface-bright)',
                color: 'var(--m3-on-surface-variant)',
              }}
            >
              No tags yet. Create your first tag above!
            </div>
          ) : (
            <div className="space-y-1.5">
              {tags.map((tag, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === tags.length - 1;
                const radius =
                  tags.length === 1
                    ? 'rounded-[24px]'
                    : isFirst
                      ? 'rounded-t-[24px] rounded-b-[6px]'
                      : isLast
                        ? 'rounded-t-[6px] rounded-b-[24px]'
                        : 'rounded-[6px]';
                const taskCount = tasks.filter((t) => (t.tagIds ?? []).includes(tag.id)).length;
                const isEditing = editingTagId === tag.id;

                return (
                  <div
                    key={tag.id}
                    className={`p-4 ${radius}`}
                    style={{ backgroundColor: 'var(--m3-surface-bright)' }}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingTagName}
                            onChange={(e) => setEditingTagName(e.target.value)}
                            className="flex-1 min-w-0 px-3.5 py-2 rounded-full text-sm font-semibold outline-none"
                            style={{
                              backgroundColor: 'var(--m3-surface-container-low)',
                              color: 'var(--m3-on-surface)',
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editingTagName.trim()) {
                                onUpdateTag({
                                  ...tag,
                                  name: editingTagName.trim(),
                                  color: editingTagColor,
                                });
                              }
                              setEditingTagId(null);
                            }}
                            className="px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
                            style={{
                              backgroundColor: 'var(--m3-primary)',
                              color: 'var(--m3-on-primary)',
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTagId(null)}
                            className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                            aria-label="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_SCHEMES.map((item) => {
                            const sel = editingTagColor.toLowerCase() === item.color.toLowerCase();
                            return (
                              <button
                                key={item.color}
                                type="button"
                                onClick={() => setEditingTagColor(item.color)}
                                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
                                style={{
                                  backgroundColor: item.color,
                                  boxShadow: sel
                                    ? '0 0 0 2px var(--m3-surface), 0 0 0 3.5px var(--m3-primary)'
                                    : 'none',
                                }}
                              >
                                {sel && <Check size={11} color="#1a1c16" strokeWidth={3} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-sm truncate">#{tag.name}</div>
                            <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                              {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagId(tag.id);
                              setEditingTagName(tag.name);
                              setEditingTagColor(tag.color);
                            }}
                            className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                            title="Edit tag"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTag(tag.id)}
                            className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                            style={{ color: 'var(--m3-error)' }}
                            title="Delete tag"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const primaryItems: {
    route: SettingsSubScreen;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }[] = [
    {
      route: 'appearance',
      icon: <Palette size={20} />,
      title: 'Appearance',
      subtitle: 'Theme, color scheme, black mode, AOD',
    },
    {
      route: 'timer',
      icon: <Clock size={20} />,
      title: 'Timer',
      subtitle: 'Daily focus goal',
    },
    {
      route: 'alarm',
      icon: <Bell size={20} />,
      title: 'Alarm',
      subtitle: 'Sound, vibration',
    },
    {
      route: 'topics',
      icon: <Tag size={20} />,
      title: 'Topics',
      subtitle: `${topics.length} ${topics.length === 1 ? 'topic' : 'topics'} configured`,
    },
    {
      route: 'tags',
      icon: <Hash size={20} />,
      title: 'Tags',
      subtitle: `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'} configured`,
    },
    {
      route: 'advanced',
      icon: <SlidersHorizontal size={20} />,
      title: 'Advanced',
      subtitle: 'Notifications, shortcuts, wake lock',
    },
  ];

  return (
    <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: hasCustomBg ? 'transparent' : 'var(--m3-surface-container)' }}>
      <div className="max-w-2xl mx-auto pt-6 space-y-4">
        <header className="text-center pb-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        </header>

        {/* Main segmented group */}
        <div className="space-y-1">
          {primaryItems.map((item, idx) => {
            const radius =
              idx === 0
                ? 'rounded-t-[24px] rounded-b-[6px]'
                : idx === primaryItems.length - 1
                  ? 'rounded-t-[6px] rounded-b-[24px]'
                  : 'rounded-[6px]';
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => onNavigate(item.route)}
                className={`w-full flex items-center justify-between p-4 ${radius} transition-opacity hover:opacity-95 cursor-pointer`}
                style={{ backgroundColor: 'var(--m3-surface-bright)' }}
              >
                <div className="flex items-center gap-4 text-left">
                  <span style={{ color: 'var(--m3-on-surface-variant)' }}>{item.icon}</span>
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      {item.subtitle}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--m3-outline)' }} />
              </button>
            );
          })}
        </div>

        {/* Secondary segmented group */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onNavigate('backup')}
            className="w-full flex items-center justify-between p-4 rounded-t-[24px] rounded-b-[6px] transition-opacity hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center gap-4 text-left">
              <HardDrive size={20} style={{ color: 'var(--m3-on-surface-variant)' }} />
              <div>
                <div className="font-semibold">Backup & restore</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Backup, restore
                </div>
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--m3-outline)' }} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('about')}
            className="w-full flex items-center justify-between p-4 rounded-t-[6px] rounded-b-[24px] transition-opacity hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: 'var(--m3-surface-bright)' }}
          >
            <div className="flex items-center gap-4 text-left">
              <Info size={20} style={{ color: 'var(--m3-on-surface-variant)' }} />
              <div>
                <div className="font-semibold">About</div>
                <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Tomato 2.0.0
                </div>
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--m3-outline)' }} />
          </button>
        </div>

        {/* Reset Data */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            className="px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer"
            style={{ color: 'var(--m3-error)' }}
          >
            Reset data
          </button>
        </div>
      </div>

      {confirmErase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setConfirmErase(false)}
        >
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 shadow-2xl"
            style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">Reset all data?</h3>
            <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
              This will permanently erase all your focus history, custom topics, and settings.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmErase(false)}
                className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
                style={{ color: 'var(--m3-primary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onEraseAllData();
                  setConfirmErase(false);
                }}
                className="px-5 py-2 rounded-full text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-error)',
                  color: 'var(--m3-on-error)',
                }}
              >
                Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

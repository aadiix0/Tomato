import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Download,
  HardDrive,
  Info,
  Palette,
  Pencil,
  Plus,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  COLOR_SCHEMES,
  DEFAULT_TOPIC_ID,
  type SettingsState,
  type SettingsSubScreen,
  type ThemeMode,
  type Topic,
} from '../types';
import { alarmPlayer } from '../utils/sound';
import { TopicShapeIcon } from './TopicShapeIcon';
import { GoogleDriveBackupCard } from './GoogleDriveBackupCard';
import type { CelebrationVariant } from './CelebrationModal';

interface SettingsScreenProps {
  settings: SettingsState;
  topics: Topic[];
  subScreen: SettingsSubScreen;
  onNavigate: (sub: SettingsSubScreen) => void;
  onUpdateSettings: (patch: Partial<SettingsState>) => void;
  onAddTopic: () => void;
  onEditTopic: (topic: Topic) => void;
  onDeleteTopic: (topicId: number) => void;
  onEraseAllData: () => void;
  onExportBackup: () => string;
  onImportBackup: (raw: string) => boolean;
  onPreviewCelebration: (variant: CelebrationVariant) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  topics,
  subScreen,
  onNavigate,
  onUpdateSettings,
  onAddTopic,
  onEditTopic,
  onDeleteTopic,
  onEraseAllData,
  onExportBackup,
  onImportBackup,
  onPreviewCelebration,
}) => {
  const [confirmErase, setConfirmErase] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const renderHeader = (title: string) => (
    <div className="flex items-center gap-3 pb-2">
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
  );

  if (subScreen === 'appearance') {
    const themes: { id: ThemeMode; label: string }[] = [
      { id: 'auto', label: 'System' },
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
    ];
    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Appearance')}

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

  if (subScreen === 'timer') {
    const goalHours = Math.floor(settings.focusGoal / 3600000);
    const goalMins = Math.floor((settings.focusGoal % 3600000) / 60000);

    const setGoal = (h: number, m: number) => {
      onUpdateSettings({ focusGoal: Math.max(0, h) * 3600000 + Math.max(0, m) * 60000 });
    };

    return (
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
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
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
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
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
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
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
        <div className="max-w-2xl mx-auto pt-5 space-y-4">
          {renderHeader('Backup & restore')}
          <GoogleDriveBackupCard
            autoSync={settings.autoDriveSync}
            lastSyncedAt={settings.lastSyncedAt}
            onToggleAutoSync={(enabled) => onUpdateSettings({ autoDriveSync: enabled })}
            onSynced={(timestampIso) => onUpdateSettings({ lastSyncedAt: timestampIso })}
            onExportBackup={onExportBackup}
            onImportBackup={onImportBackup}
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
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
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
      <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
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
      route: 'advanced',
      icon: <SlidersHorizontal size={20} />,
      title: 'Advanced',
      subtitle: 'Notifications, shortcuts, wake lock',
    },
  ];

  return (
    <div className="min-h-screen pb-28 px-4" style={{ backgroundColor: 'var(--m3-surface-container)' }}>
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

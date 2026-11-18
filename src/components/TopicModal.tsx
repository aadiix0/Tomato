import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  COLOR_SCHEMES,
  TOPIC_SHAPES,
  type Topic,
  type TopicShape,
} from '../types';
import { TopicShapeIcon } from './TopicShapeIcon';

interface TopicModalProps {
  initialTopic?: Topic;
  existingNames: string[];
  onClose: () => void;
  onSave: (data: Omit<Topic, 'id'>, existingId?: number) => void;
}

export const TopicModal: React.FC<TopicModalProps> = ({
  initialTopic,
  existingNames,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialTopic?.name ?? '');
  const [color, setColor] = useState(initialTopic?.color ?? '#ffffff');
  const [shape, setShape] = useState<TopicShape>(initialTopic?.shape ?? 'COOKIE_7_SIDED');
  const [focusMin, setFocusMin] = useState(
    Math.round((initialTopic?.focusTime ?? 25 * 60 * 1000) / 60000)
  );
  const [shortBreakMin, setShortBreakMin] = useState(
    Math.round((initialTopic?.shortBreakTime ?? 5 * 60 * 1000) / 60000)
  );
  const [longBreakMin, setLongBreakMin] = useState(
    Math.round((initialTopic?.longBreakTime ?? 15 * 60 * 1000) / 60000)
  );
  const [sessionLength, setSessionLength] = useState(initialTopic?.sessionLength ?? 4);
  const [autostartNextSession, setAutostartNextSession] = useState(
    initialTopic?.autostartNextSession ?? false
  );
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Topic name is required');
      return;
    }
    const lower = trimmed.toLowerCase();
    const isDuplicate = existingNames.some(
      (n) =>
        n.toLowerCase() === lower &&
        n.toLowerCase() !== (initialTopic?.name ?? '').toLowerCase()
    );
    if (isDuplicate) {
      setError('A topic with this name already exists');
      return;
    }
    onSave(
      {
        name: trimmed,
        color,
        shape,
        focusTime: Math.max(1, focusMin) * 60 * 1000,
        shortBreakTime: Math.max(1, shortBreakMin) * 60 * 1000,
        longBreakTime: Math.max(1, longBreakMin) * 60 * 1000,
        sessionLength: Math.min(12, Math.max(1, sessionLength)),
        autostartNextSession,
        dndEnabled: initialTopic?.dndEnabled ?? false,
      },
      initialTopic?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          color: 'var(--m3-on-surface)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <TopicShapeIcon shape={shape} color={color} size={28} />
            <h2 className="text-xl font-bold">
              {initialTopic ? 'Edit topic' : 'Create new topic'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Topic name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Study, Deep Work, Reading"
              className="w-full px-4 py-3 rounded-2xl text-base outline-none border transition-colors"
              style={{
                backgroundColor: 'var(--m3-surface-container-high)',
                borderColor: error ? 'var(--m3-error)' : 'transparent',
                color: 'var(--m3-on-surface)',
              }}
              autoFocus
            />
            {error && (
              <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--m3-error)' }}>
                {error}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor('#ffffff')}
                className="h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-transform active:scale-95 cursor-pointer"
                style={{
                  backgroundColor:
                    color === '#ffffff' ? 'var(--m3-primary)' : 'var(--m3-secondary-container)',
                  color:
                    color === '#ffffff' ? 'var(--m3-on-primary)' : 'var(--m3-on-secondary-container)',
                  borderColor: 'transparent',
                }}
              >
                {color === '#ffffff' && <Check size={14} />}
                Default
              </button>
              {COLOR_SCHEMES.map((item) => {
                const selected = color.toLowerCase() === item.color.toLowerCase();
                return (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => setColor(item.color)}
                    title={item.name}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: selected ? '0 0 0 2px var(--m3-surface), 0 0 0 4px var(--m3-primary)' : 'none',
                    }}
                  >
                    {selected && <Check size={16} color="#1a1c16" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Shape
            </label>
            <div className="grid grid-cols-6 gap-2">
              {TOPIC_SHAPES.map((s) => {
                const selected = shape === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShape(s)}
                    className="h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer"
                    style={{
                      backgroundColor: selected
                        ? 'var(--m3-primary-container)'
                        : 'var(--m3-surface-container-high)',
                    }}
                  >
                    <TopicShapeIcon shape={s} color={color} size={22} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Focus (min)
              </label>
              <input
                type="number"
                min={1}
                max={180}
                value={focusMin}
                onChange={(e) => setFocusMin(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-2xl text-center font-bold tabular-nums outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface-container-high)',
                  color: 'var(--m3-on-surface)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Short break
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={shortBreakMin}
                onChange={(e) => setShortBreakMin(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-2xl text-center font-bold tabular-nums outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface-container-high)',
                  color: 'var(--m3-on-surface)',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Long break
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={longBreakMin}
                onChange={(e) => setLongBreakMin(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-2xl text-center font-bold tabular-nums outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface-container-high)',
                  color: 'var(--m3-on-surface)',
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm font-semibold mb-1.5">
              <span style={{ color: 'var(--m3-on-surface-variant)' }}>Session length</span>
              <span className="tabular-nums" style={{ color: 'var(--m3-primary)' }}>
                {sessionLength} intervals
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={sessionLength}
              onChange={(e) => setSessionLength(Number(e.target.value))}
              className="w-full accent-[var(--m3-primary)] cursor-pointer"
            />
          </div>

          <label
            className="flex items-center justify-between p-3.5 rounded-2xl cursor-pointer"
            style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
          >
            <div>
              <div className="text-sm font-semibold">Autostart next session</div>
              <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Automatically start focus or break when timer ends
              </div>
            </div>
            <input
              type="checkbox"
              checked={autostartNextSession}
              onChange={(e) => setAutostartNextSession(e.target.checked)}
              className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer"
              style={{ color: 'var(--m3-primary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

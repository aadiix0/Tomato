import React, { useEffect, useState } from 'react';
import { Cat, Clock, Flame, Sparkles, Trophy, X, Zap } from 'lucide-react';
import { millisecondsToHoursMinutes } from '../utils/time';

export type CelebrationVariant = 'task' | 'focus_complete' | 'break_complete' | 'daily_goal';

export interface FocusSummaryData {
  sessionMs: number;
  todayTotalMs: number;
  dailyGoalMs?: number;
}

interface CelebrationModalProps {
  title: string;
  subtitle?: string;
  variant?: CelebrationVariant;
  focusSummary?: FocusSummaryData;
  nextTaskTitle?: string;
  onBlitzNextTask?: () => void;
  onClose: () => void;
}

interface MediaItem {
  url: string;
  caption: string;
}

const CELEBRATION_GIFS: MediaItem[] = [
  {
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    caption: 'Crushed it! Keep that momentum going!',
  },
  {
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    caption: 'Boom! Another win in the books!',
  },
  {
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    caption: 'You are on fire today!',
  },
  {
    url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
    caption: 'Productivity level: Legendary!',
  },
  {
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    caption: 'Nicely done! Enjoy your well-earned break.',
  },
  {
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
    caption: 'Absolute focus master!',
  },
];

const MOTIVATION_GIFS: MediaItem[] = [
  {
    url: 'https://media.giphy.com/media/UqZ4imFIoljlr5O2sM/giphy.gif',
    caption: 'Break is over—let’s lock in and make it count!',
  },
  {
    url: 'https://media.giphy.com/media/12XDYvMJNcmLgQ/giphy.gif',
    caption: 'You’ve got this! Time to get back in the zone.',
  },
  {
    url: 'https://media.giphy.com/media/yoJC2K6rCzwNY2EngA/giphy.gif',
    caption: 'Recharged and ready. Let’s crush the next session!',
  },
  {
    url: 'https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif',
    caption: 'Focus mode: ACTIVATED.',
  },
  {
    url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    caption: 'Hands on the keyboard—time to cook!',
  },
];

const CAT_GIFS: MediaItem[] = [
  {
    url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif',
    caption: 'Vibing cat approves of your daily focus goal!',
  },
  {
    url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif',
    caption: 'Purr-fect focus today! Sending virtual headbutts.',
  },
  {
    url: 'https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif',
    caption: 'Daily goal smashed! Certified top cat.',
  },
  {
    url: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif',
    caption: 'Maximum focus energy unlocked!',
  },
  {
    url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
    caption: 'Now you can chill like a cat.',
  },
];

const CONFETTI_COLORS = ['#4c662b', '#cdeda3', '#386663', '#e8c16c', '#ffa79b', '#b0c6ff', '#d7bbfc'];

const VARIANT_CONFIG: Record<
  CelebrationVariant,
  {
    badge: string;
    cta: string;
    subreddits: string[];
    gifs: MediaItem[];
    showConfetti: boolean;
    useCataasGif?: boolean;
  }
> = {
  task: {
    badge: 'Task Crushed!',
    cta: 'Keep Going',
    subreddits: ['wholesomememes'],
    gifs: CELEBRATION_GIFS,
    showConfetti: true,
  },
  focus_complete: {
    badge: 'Focus Session Done!',
    cta: 'Enjoy Your Break',
    subreddits: ['wholesomememes', 'MadeMeSmile'],
    gifs: CELEBRATION_GIFS,
    showConfetti: true,
  },
  break_complete: {
    badge: 'Break Over · Lock In!',
    cta: "Let's Focus!",
    subreddits: ['GetMotivated', 'wholesomememes'],
    gifs: MOTIVATION_GIFS,
    showConfetti: false,
  },
  daily_goal: {
    badge: 'Daily Focus Goal Reached!',
    cta: 'Purr-fect!',
    subreddits: ['Catmemes', 'MEOW_IRL'],
    gifs: CAT_GIFS,
    showConfetti: true,
    useCataasGif: true,
  },
};

function playChime(variant: CelebrationVariant) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes =
      variant === 'break_complete'
        ? [440, 554.37, 659.25]
        : variant === 'daily_goal'
          ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
          : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.5);
    });
  } catch {
    // Ignore audio errors
  }
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  title,
  subtitle,
  variant = 'task',
  focusSummary,
  nextTaskTitle,
  onBlitzNextTask,
  onClose,
}) => {
  const config = VARIANT_CONFIG[variant];

  const [gif, setGif] = useState<MediaItem>(() => {
    const fallback = config.gifs[Math.floor(Math.random() * config.gifs.length)];
    if (config.useCataasGif) {
      return {
        url: `https://cataas.com/cat/gif?t=${Date.now()}`,
        caption: fallback.caption,
      };
    }
    return fallback;
  });

  const [meme, setMeme] = useState<MediaItem | null>(null);
  const [memeLoading, setMemeLoading] = useState(true);

  useEffect(() => {
    playChime(variant);
    let cancelled = false;

    const fetchFreshMeme = async () => {
      try {
        const sub = config.subreddits[Math.floor(Math.random() * config.subreddits.length)];
        const res = await fetch(`https://meme-api.com/gimme/${sub}`);
        if (!res.ok) throw new Error('Meme API unavailable');
        const data = (await res.json()) as { url?: string; title?: string; nsfw?: boolean };
        if (!cancelled && data.url && !data.nsfw) {
          setMeme({
            url: data.url,
            caption: data.title || config.gifs[0].caption,
          });
        }
      } catch {
        // Fallback to a different GIF from the pool if meme API is unreachable
        if (!cancelled) {
          const alt = config.gifs[(Math.floor(Math.random() * config.gifs.length) + 1) % config.gifs.length];
          setMeme(alt);
        }
      } finally {
        if (!cancelled) setMemeLoading(false);
      }
    };

    void fetchFreshMeme();
    return () => {
      cancelled = true;
    };
  }, [variant, config]);

  const BadgeIcon =
    variant === 'daily_goal'
      ? Cat
      : variant === 'break_complete'
        ? Flame
        : variant === 'focus_complete'
          ? Trophy
          : Sparkles;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      {/* Confetti dots for celebrations */}
      {config.showConfetti && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="absolute w-2.5 h-2.5 rounded-sm animate-bounce"
              style={{
                left: `${(i * 4.2 + 2) % 98}%`,
                top: `${(i * 13 + 5) % 85}%`,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${(i % 6) * 0.12}s`,
                animationDuration: `${0.9 + (i % 4) * 0.25}s`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[28px] p-5 sm:p-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          color: 'var(--m3-on-surface)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-black/10 cursor-pointer"
          aria-label="Close popup"
        >
          <X size={18} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-5 items-stretch">
          {/* Left Column: GIF on top + Meme below (fits without scrolling) */}
          <div className="space-y-3 text-left">
            {/* 1. Animated GIF */}
            <div
              className="rounded-2xl p-2.5 space-y-1.5"
              style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {variant === 'daily_goal' ? 'Cat GIF' : 'GIF'}
              </div>
              <div className="w-full h-40 rounded-xl overflow-hidden flex items-center justify-center bg-black/5">
                <img
                  src={gif.url}
                  alt={gif.caption}
                  onError={() => {
                    const fallback = config.gifs[Math.floor(Math.random() * config.gifs.length)];
                    if (gif.url !== fallback.url) setGif(fallback);
                  }}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[11px] font-semibold px-1 line-clamp-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {gif.caption}
              </p>
            </div>

            {/* 2. Fresh Meme */}
            <div
              className="rounded-2xl p-2.5 space-y-1.5"
              style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {variant === 'daily_goal' ? 'Cat Meme' : 'Meme'}
              </div>
              <div className="w-full h-44 rounded-xl overflow-hidden flex items-center justify-center bg-black/5">
                {memeLoading || !meme ? (
                  <span className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Loading fresh meme…
                  </span>
                ) : (
                  <img
                    src={meme.url}
                    alt={meme.caption}
                    onError={() => {
                      const fallback = config.gifs[Math.floor(Math.random() * config.gifs.length)];
                      if (meme.url !== fallback.url) setMeme(fallback);
                    }}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              {meme && (
                <p className="text-[11px] font-semibold px-1 line-clamp-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  {meme.caption}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Badge, Title, Session & Daily Summary, and Action Buttons */}
          <div className="flex flex-col justify-between text-center md:text-left space-y-4 pt-1 md:pt-4">
            <div className="space-y-4">
              <div className="flex justify-center md:justify-start">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor:
                      variant === 'break_complete'
                        ? 'var(--m3-tertiary-container)'
                        : 'var(--m3-primary-container)',
                    color:
                      variant === 'break_complete'
                        ? 'var(--m3-on-tertiary-container)'
                        : 'var(--m3-on-primary-container)',
                  }}
                >
                  <BadgeIcon size={14} />
                  {config.badge}
                </div>
              </div>

              <div>
                <h2 className="text-xl font-extrabold leading-snug">{title}</h2>
                {subtitle && (
                  <p className="text-xs mt-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Instant Session & Today Focus Summary */}
              {focusSummary && (
                <div
                  className="rounded-2xl p-3 space-y-2.5 text-left"
                  style={{ backgroundColor: 'var(--m3-surface-container-high)' }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className="rounded-xl p-2.5"
                      style={{ backgroundColor: 'var(--m3-surface-bright)' }}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        <Clock size={11} />
                        This Session
                      </div>
                      <div className="text-lg font-extrabold tabular-nums mt-0.5" style={{ color: 'var(--m3-primary)' }}>
                        {millisecondsToHoursMinutes(focusSummary.sessionMs)}
                      </div>
                    </div>
                    <div
                      className="rounded-xl p-2.5"
                      style={{ backgroundColor: 'var(--m3-surface-bright)' }}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        <Flame size={11} />
                        Today Total
                      </div>
                      <div className="text-lg font-extrabold tabular-nums mt-0.5">
                        {millisecondsToHoursMinutes(focusSummary.todayTotalMs)}
                      </div>
                    </div>
                  </div>

                  {focusSummary.dailyGoalMs && focusSummary.dailyGoalMs > 0 ? (
                    <div className="space-y-1 px-0.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        <span>Daily goal progress</span>
                        <span className="tabular-nums font-bold">
                          {Math.min(100, Math.round((focusSummary.todayTotalMs / focusSummary.dailyGoalMs) * 100))}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--m3-surface-container-highest)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.round((focusSummary.todayTotalMs / focusSummary.dailyGoalMs) * 100))}%`,
                            backgroundColor: 'var(--m3-primary)',
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Action Buttons right below Summary */}
            <div className="space-y-2 pt-2">
              {nextTaskTitle && onBlitzNextTask && (
                <button
                  type="button"
                  onClick={() => {
                    onBlitzNextTask();
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-full text-sm font-bold cursor-pointer transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--m3-primary)',
                    color: 'var(--m3-on-primary)',
                  }}
                >
                  <Zap size={16} />
                  <span className="truncate">Blitz Next: {nextTaskTitle}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-full text-sm font-bold cursor-pointer transition-opacity hover:opacity-90"
                style={{
                  backgroundColor:
                    nextTaskTitle && onBlitzNextTask
                      ? 'var(--m3-surface-container-high)'
                      : variant === 'break_complete'
                        ? 'var(--m3-tertiary)'
                        : 'var(--m3-primary)',
                  color:
                    nextTaskTitle && onBlitzNextTask
                      ? 'var(--m3-on-surface)'
                      : variant === 'break_complete'
                        ? 'var(--m3-on-tertiary)'
                        : 'var(--m3-on-primary)',
                }}
              >
                {config.cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

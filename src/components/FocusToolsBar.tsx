import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  Coffee,
  Headphones,
  ListPlus,
  Music,
  NotebookPen,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from 'lucide-react';
import { ambientAudio, type AmbientSoundType } from '../utils/ambientAudio';

interface FocusToolsBarProps {
  onSendNoteToBacklog: (title: string) => void;
}

type ToolPanel = 'none' | 'ambient' | 'spotify' | 'notes';

interface FocusNote {
  id: string;
  text: string;
}

const NOTES_KEY = 'tomato_focus_notes_v1';
const SPOTIFY_KEY = 'tomato_spotify_embed_v1';

const SPOTIFY_PRESETS = [
  { label: 'Lo-Fi Beats', uri: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn' },
  { label: 'Deep Focus', uri: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ' },
  { label: 'Peaceful Piano', uri: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO' },
  { label: 'Jazz Vibes', uri: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX0SM0LYsmbMT' },
];

function parseSpotifyToEmbedUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Already an embed URL
  if (trimmed.includes('open.spotify.com/embed/')) return trimmed;
  // Standard open.spotify.com/{type}/{id}
  const match = trimmed.match(/open\.spotify\.com\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/);
  if (match) {
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
  }
  // spotify:playlist:{id} URI
  const uriMatch = trimmed.match(/spotify:(playlist|album|track):([a-zA-Z0-9]+)/);
  if (uriMatch) {
    return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}`;
  }
  return null;
}

export const FocusToolsBar: React.FC<FocusToolsBarProps> = ({ onSendNoteToBacklog }) => {
  const [openPanel, setOpenPanel] = useState<ToolPanel>('none');
  const [soundType, setSoundType] = useState<AmbientSoundType>('off');
  const [volume, setVolume] = useState(0.4);

  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState<string>(() => {
    return localStorage.getItem(SPOTIFY_KEY) || SPOTIFY_PRESETS[0].uri;
  });
  const [spotifyInput, setSpotifyInput] = useState('');
  const [spotifyError, setSpotifyError] = useState('');

  const [notes, setNotes] = useState<FocusNote[]>(() => {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      return raw ? (JSON.parse(raw) as FocusNote[]) : [];
    } catch {
      return [];
    }
  });
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(SPOTIFY_KEY, spotifyEmbedUrl);
  }, [spotifyEmbedUrl]);

  useEffect(() => {
    return () => {
      ambientAudio.stop();
    };
  }, []);

  const handleSelectSound = (next: AmbientSoundType) => {
    const resolved = soundType === next ? 'off' : next;
    setSoundType(resolved);
    ambientAudio.play(resolved, volume);
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    ambientAudio.setVolume(v);
  };

  const handleApplySpotifyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const embed = parseSpotifyToEmbedUrl(spotifyInput);
    if (!embed) {
      setSpotifyError('Paste a valid Spotify playlist, album, or track link.');
      return;
    }
    setSpotifyError('');
    setSpotifyEmbedUrl(embed);
    setSpotifyInput('');
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = noteInput.trim();
    if (!clean) return;
    setNotes((prev) => [{ id: `${Date.now()}`, text: clean }, ...prev]);
    setNoteInput('');
  };

  const togglePanel = (panel: ToolPanel) => {
    setOpenPanel((cur) => (cur === panel ? 'none' : panel));
  };

  const soundOptions: { id: AmbientSoundType; label: string; icon: React.ReactNode }[] = [
    { id: 'rain', label: 'Rain', icon: <CloudRain size={15} /> },
    { id: 'brown', label: 'Brown Noise', icon: <Wind size={15} /> },
    { id: 'ocean', label: 'Ocean', icon: <Waves size={15} /> },
    { id: 'cafe', label: 'Café Hum', icon: <Coffee size={15} /> },
  ];

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-3 mt-1">
      {/* Compact Trigger Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => togglePanel('ambient')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
          style={{
            backgroundColor:
              openPanel === 'ambient' || soundType !== 'off'
                ? 'var(--m3-primary-container)'
                : 'var(--m3-surface-container-high)',
            color:
              openPanel === 'ambient' || soundType !== 'off'
                ? 'var(--m3-on-primary-container)'
                : 'var(--m3-on-surface-variant)',
          }}
        >
          <Headphones size={14} />
          {soundType !== 'off' ? `Ambient: ${soundType}` : 'Ambient'}
        </button>

        <button
          type="button"
          onClick={() => togglePanel('spotify')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
          style={{
            backgroundColor:
              openPanel === 'spotify'
                ? 'var(--m3-primary-container)'
                : 'var(--m3-surface-container-high)',
            color:
              openPanel === 'spotify'
                ? 'var(--m3-on-primary-container)'
                : 'var(--m3-on-surface-variant)',
          }}
        >
          <Music size={14} />
          Spotify
        </button>

        <button
          type="button"
          onClick={() => togglePanel('notes')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer"
          style={{
            backgroundColor:
              openPanel === 'notes'
                ? 'var(--m3-primary-container)'
                : 'var(--m3-surface-container-high)',
            color:
              openPanel === 'notes'
                ? 'var(--m3-on-primary-container)'
                : 'var(--m3-on-surface-variant)',
          }}
        >
          <NotebookPen size={14} />
          Notes{notes.length > 0 ? ` (${notes.length})` : ''}
        </button>
      </div>

      {/* Ambient Sounds Panel */}
      {openPanel === 'ambient' && (
        <div
          className="w-full rounded-[24px] p-4 space-y-3 shadow-sm"
          style={{ backgroundColor: 'var(--m3-surface-bright)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Ambient Focus Sounds
            </span>
            {soundType !== 'off' && (
              <button
                type="button"
                onClick={() => handleSelectSound('off')}
                className="inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
                style={{ color: 'var(--m3-primary)' }}
              >
                <VolumeX size={14} /> Mute
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {soundOptions.map((opt) => {
              const active = soundType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectSound(opt.id)}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                  style={{
                    backgroundColor: active
                      ? 'var(--m3-primary)'
                      : 'var(--m3-surface-container-low)',
                    color: active ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <Volume2 size={15} style={{ color: 'var(--m3-on-surface-variant)' }} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full accent-[var(--m3-primary)] cursor-pointer"
              aria-label="Ambient volume"
            />
          </div>
        </div>
      )}

      {/* Spotify Embed Player Panel */}
      {openPanel === 'spotify' && (
        <div
          className="w-full rounded-[24px] p-4 space-y-3 shadow-sm"
          style={{ backgroundColor: 'var(--m3-surface-bright)' }}
        >
          <div className="flex flex-wrap gap-1.5">
            {SPOTIFY_PRESETS.map((p) => {
              const active = spotifyEmbedUrl === p.uri;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSpotifyEmbedUrl(p.uri)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer"
                  style={{
                    backgroundColor: active
                      ? 'var(--m3-primary)'
                      : 'var(--m3-surface-container-low)',
                    color: active ? 'var(--m3-on-primary)' : 'var(--m3-on-surface)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <iframe
            title="Spotify Focus Player"
            src={`${spotifyEmbedUrl}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-2xl"
          />

          <form onSubmit={handleApplySpotifyUrl} className="flex gap-2">
            <input
              type="text"
              value={spotifyInput}
              onChange={(e) => setSpotifyInput(e.target.value)}
              placeholder="Paste any Spotify playlist/track URL…"
              className="flex-1 min-w-0 px-3 py-1.5 rounded-full text-xs outline-none"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                color: 'var(--m3-on-surface)',
              }}
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              Load
            </button>
          </form>
          {spotifyError && (
            <p className="text-[11px] font-semibold" style={{ color: 'var(--m3-error)' }}>
              {spotifyError}
            </p>
          )}
        </div>
      )}

      {/* Distraction Dump / Quick Focus Notes Panel */}
      {openPanel === 'notes' && (
        <div
          className="w-full rounded-[24px] p-4 space-y-3 shadow-sm"
          style={{ backgroundColor: 'var(--m3-surface-bright)' }}
        >
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--m3-on-surface-variant)' }}>
            Distraction Dump · Jot & Stay Focused
          </div>
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Random thought? Park it here…"
              className="flex-1 min-w-0 px-3 py-2 rounded-full text-xs outline-none"
              style={{
                backgroundColor: 'var(--m3-surface-container-low)',
                color: 'var(--m3-on-surface)',
              }}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              Add
            </button>
          </form>

          {notes.length === 0 ? (
            <p className="text-xs text-center py-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Clear mind! Park stray thoughts here without breaking flow.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl text-xs"
                  style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
                >
                  <span className="flex-1 break-words font-medium">{n.text}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSendNoteToBacklog(n.text);
                        setNotes((prev) => prev.filter((item) => item.id !== n.id));
                      }}
                      className="p-1.5 rounded-full hover:bg-black/10 cursor-pointer"
                      title="Convert to Backlog task"
                      style={{ color: 'var(--m3-primary)' }}
                    >
                      <ListPlus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotes((prev) => prev.filter((item) => item.id !== n.id))}
                      className="p-1.5 rounded-full hover:bg-black/10 cursor-pointer"
                      title="Delete note"
                      style={{ color: 'var(--m3-on-surface-variant)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

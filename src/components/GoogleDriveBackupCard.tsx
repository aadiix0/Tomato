import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  ExternalLink,
  Laptop,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  downloadDriveBackup,
  findDriveBackupFile,
  getAccessToken,
  googleSignIn,
  googleSignOut,
  initAuth,
  syncWithGoogleDrive,
  uploadDriveBackup,
  type DriveBackupMeta,
} from '../services/googleDriveSync';

interface GoogleDriveBackupCardProps {
  autoSync: boolean;
  lastSyncedAt: string | null;
  lastModified?: number;
  isPristine?: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  onSynced: (timestampIso: string) => void;
  onExportBackup: () => string;
  onImportBackup: (raw: string) => boolean;
  onShowToast?: (message: string) => void;
}

export const GoogleDriveBackupCard: React.FC<GoogleDriveBackupCardProps> = ({
  autoSync,
  lastSyncedAt,
  lastModified = Date.now(),
  isPristine = false,
  onToggleAutoSync,
  onSynced,
  onExportBackup,
  onImportBackup,
  onShowToast,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [driveFile, setDriveFile] = useState<DriveBackupMeta | null>(null);
  const [remoteBackupInfo, setRemoteBackupInfo] = useState<{
    topicCount?: number;
    statCount?: number;
    taskCount?: number;
    exportedAt?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'upload' | 'restore' | 'enableAuto' | null>(
    null
  );

  useEffect(() => {
    const unsub = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        void checkRemoteBackup(token);
      },
      () => {
        setUser(null);
        setDriveFile(null);
        setRemoteBackupInfo(null);
      }
    );
    return () => unsub();
  }, []);

  const checkRemoteBackup = async (token: string) => {
    try {
      const file = await findDriveBackupFile(token);
      setDriveFile(file);
      if (file) {
        try {
          const raw = await downloadDriveBackup(token, file.id);
          const parsed = JSON.parse(raw);
          setRemoteBackupInfo({
            topicCount: Array.isArray(parsed.topics) ? parsed.topics.length : 0,
            statCount: Array.isArray(parsed.stats) ? parsed.stats.length : 0,
            taskCount: Array.isArray(parsed.tasks) ? parsed.tasks.length : 0,
            exportedAt: parsed.exportedAt || file.modifiedTime,
          });
        } catch {
          // ignore parsing error
        }
      }
    } catch {
      // Ignore silent lookup error
    }
  };

  const handleCopyDomain = (domain: string) => {
    void navigator.clipboard?.writeText(domain);
    setCopiedDomain(domain);
    setTimeout(() => setCopiedDomain(null), 3000);
  };

  const handleSignIn = async () => {
    setBusy(true);
    setStatusMsg('');
    setIsUnauthorizedDomain(false);
    try {
      const { user: authedUser, accessToken } = await googleSignIn();
      setUser(authedUser);
      onToggleAutoSync(true);

      // Perform smart two-way sync: auto-restores if remote exists and local is pristine/older
      const result = await syncWithGoogleDrive(
        accessToken,
        onExportBackup,
        lastModified,
        isPristine,
        onImportBackup
      );

      if (result.file) {
        setDriveFile(result.file);
        if (result.file.modifiedTime) {
          onSynced(result.file.modifiedTime);
        }
      }

      if (result.remoteData) {
        setRemoteBackupInfo({
          topicCount: Array.isArray(result.remoteData.topics) ? result.remoteData.topics.length : 0,
          statCount: Array.isArray(result.remoteData.stats) ? result.remoteData.stats.length : 0,
          taskCount: Array.isArray(result.remoteData.tasks) ? result.remoteData.tasks.length : 0,
          exportedAt: result.remoteData.exportedAt,
        });
      }

      setStatusMsg(result.message);
      setStatusType(result.status === 'error' ? 'error' : 'success');
      onShowToast?.(result.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unauthorized-domain') || msg.includes('auth/unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
        setStatusMsg('Firebase Error (auth/unauthorized-domain): This domain is not authorized in your Firebase project.');
      } else {
        setStatusMsg(msg || 'Google sign-in failed.');
      }
      setStatusType('error');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    const token = getAccessToken();
    if (!token) {
      setStatusMsg('Please reconnect with Google to sync with Drive.');
      setStatusType('info');
      await handleSignIn();
      return;
    }
    setBusy(true);
    setStatusMsg('');
    try {
      const result = await syncWithGoogleDrive(
        token,
        onExportBackup,
        lastModified,
        isPristine,
        onImportBackup
      );
      if (result.file) {
        setDriveFile(result.file);
        if (result.file.modifiedTime) {
          onSynced(result.file.modifiedTime);
        }
      }
      if (result.remoteData) {
        setRemoteBackupInfo({
          topicCount: Array.isArray(result.remoteData.topics) ? result.remoteData.topics.length : 0,
          statCount: Array.isArray(result.remoteData.stats) ? result.remoteData.stats.length : 0,
          taskCount: Array.isArray(result.remoteData.tasks) ? result.remoteData.tasks.length : 0,
          exportedAt: result.remoteData.exportedAt,
        });
      }
      setStatusMsg(result.message);
      setStatusType(result.status === 'error' ? 'error' : 'success');
      onShowToast?.(result.message);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Sync failed.');
      setStatusType('error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmUpload = async () => {
    setConfirmAction(null);
    const token = getAccessToken();
    if (!token) {
      setStatusMsg('Session expired. Please sign in with Google again.');
      setStatusType('error');
      setUser(null);
      return;
    }
    setBusy(true);
    setStatusMsg('');
    try {
      const json = onExportBackup();
      const saved = await uploadDriveBackup(token, json, driveFile?.id);
      setDriveFile(saved);
      onSynced(saved.modifiedTime ?? new Date().toISOString());
      setStatusMsg('All topics, tasks, stats & settings successfully saved to Google Drive.');
      setStatusType('success');
      onShowToast?.('Backup saved to Google Drive.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to save backup to Google Drive.');
      setStatusType('error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    setConfirmAction(null);
    const token = getAccessToken();
    if (!token || !driveFile) {
      setStatusMsg('No Google Drive backup available to restore.');
      setStatusType('error');
      return;
    }
    setBusy(true);
    setStatusMsg('');
    try {
      const raw = await downloadDriveBackup(token, driveFile.id);
      const ok = onImportBackup(raw);
      if (ok && driveFile.modifiedTime) {
        onSynced(driveFile.modifiedTime);
      }
      const parsed = JSON.parse(raw);
      const topicCount = Array.isArray(parsed.topics) ? parsed.topics.length : 0;
      setStatusMsg(
        ok
          ? `Restored ${topicCount} topics, customizations, tasks & stats from Google Drive.`
          : 'Backup file was invalid.'
      );
      setStatusType(ok ? 'success' : 'error');
      if (ok) {
        onShowToast?.(`Restored ${topicCount} topics & settings from Google Drive.`);
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to restore from Google Drive.');
      setStatusType('error');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setDriveFile(null);
    setRemoteBackupInfo(null);
    setStatusMsg('Signed out of Google Drive.');
    setStatusType('info');
  };

  const displayLastSynced = lastSyncedAt ?? driveFile?.modifiedTime ?? null;

  return (
    <div className="space-y-3">
      <div
        className="rounded-[24px] p-5 space-y-4 shadow-sm"
        style={{ backgroundColor: 'var(--m3-surface-bright)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--m3-primary-container)',
                color: 'var(--m3-on-primary-container)',
              }}
            >
              <Cloud size={20} />
            </div>
            <div>
              <div className="font-bold flex items-center gap-2">
                <span>Google Drive Sync</span>
                {user && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: 'var(--m3-secondary-container)',
                      color: 'var(--m3-on-secondary-container)',
                    }}
                  >
                    Connected
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Last synced:{' '}
                <span className="font-semibold">
                  {displayLastSynced ? new Date(displayLastSynced).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {user && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSyncNow()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary-container)',
                color: 'var(--m3-on-primary-container)',
              }}
              title="Sync now"
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              <span>Sync</span>
            </button>
          )}
        </div>

        {/* Cross-device explanation banner */}
        <div
          className="p-3.5 rounded-2xl flex items-start gap-2.5 text-xs"
          style={{
            backgroundColor: 'var(--m3-surface-container-low)',
            color: 'var(--m3-on-surface-variant)',
          }}
        >
          <Laptop size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--m3-primary)' }} />
          <div>
            <span className="font-bold text-sm block mb-0.5" style={{ color: 'var(--m3-on-surface)' }}>
              Seamless Cross-PC & Local Persistence
            </span>
            Zonein saves your topics, stats, tasks, wallpapers, and timer styles directly to this PC’s hard drive, and automatically syncs to your Google Drive to restore on any PC connected to the same account.
          </div>
        </div>

        {/* Auto-sync toggle */}
        <label
          className="flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
        >
          <div className="pr-3">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <span>Automatic Google Drive sync</span>
              <Sparkles size={14} style={{ color: 'var(--m3-primary)' }} />
            </div>
            <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {autoSync
                ? 'Automatically backs up topics, customizations & focus stats in background'
                : 'Manual mode — sync only when you click Back up'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => {
              if (e.target.checked) {
                setConfirmAction('enableAuto');
              } else {
                onToggleAutoSync(false);
              }
            }}
            className="w-5 h-5 accent-[var(--m3-primary)] cursor-pointer shrink-0"
          />
        </label>

        {!user ? (
          <div className="space-y-3 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSignIn()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-5 py-3 rounded-full bg-white text-[#1f1f1f] border border-[#747775] text-sm font-semibold shadow-xs hover:bg-[#f8f9fa] transition-colors disabled:opacity-60 cursor-pointer"
            >
              <svg viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{busy ? 'Signing in & syncing...' : 'Sign in with Google to Auto-Sync'}</span>
            </button>

            <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: 'var(--m3-on-surface-variant)' }}>
              <span>Local domain:</span>
              <code className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-black/5 dark:bg-white/10">
                {typeof window !== 'undefined' ? window.location.hostname : ''}
              </code>
              <button
                type="button"
                onClick={() => handleCopyDomain(typeof window !== 'undefined' ? window.location.hostname : '')}
                className="inline-flex items-center gap-1 font-semibold text-[11px] underline cursor-pointer hover:opacity-80"
              >
                {copiedDomain === (typeof window !== 'undefined' ? window.location.hostname : '') ? (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* User profile bar */}
            <div
              className="flex items-center justify-between p-3.5 rounded-2xl"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div className="min-w-0 flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-9 h-9 rounded-full shrink-0 border border-black/10"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{
                      backgroundColor: 'var(--m3-primary)',
                      color: 'var(--m3-on-primary)',
                    }}
                  >
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-xs truncate flex items-center gap-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    <span>Connected · {autoSync ? 'Auto-sync active' : 'Manual sync'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>

            {/* Remote backup details pill if available */}
            {remoteBackupInfo && (
              <div
                className="p-3 rounded-2xl text-xs space-y-1"
                style={{
                  backgroundColor: 'var(--m3-surface-container-high)',
                  color: 'var(--m3-on-surface)',
                }}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Google Drive Backup Status:</span>
                  <span className="font-mono text-[11px] opacity-75">zonein-backup.json</span>
                </div>
                <div className="text-[11px] opacity-80 flex items-center gap-3 flex-wrap">
                  <span>{remoteBackupInfo.topicCount ?? 0} topics</span>
                  <span>•</span>
                  <span>{remoteBackupInfo.statCount ?? 0} stats</span>
                  <span>•</span>
                  <span>{remoteBackupInfo.taskCount ?? 0} tasks</span>
                  {remoteBackupInfo.exportedAt && (
                    <>
                      <span>•</span>
                      <span>Modified: {new Date(remoteBackupInfo.exportedAt).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSyncNow()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                Sync Now
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction('upload')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-surface-container-high)',
                  color: 'var(--m3-on-surface)',
                }}
              >
                <CloudUpload size={16} />
                Back up to Drive
              </button>

              {driveFile && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction('restore')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--m3-secondary-container)',
                    color: 'var(--m3-on-secondary-container)',
                  }}
                >
                  <CloudDownload size={16} />
                  Restore from Drive
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isUnauthorizedDomain ? (
        <div
          className="p-5 rounded-[24px] border space-y-3.5"
          style={{
            backgroundColor: 'var(--m3-error-container)',
            borderColor: 'var(--m3-error)',
            color: 'var(--m3-on-error-container)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--m3-error)' }} />
            <div>
              <div className="font-bold text-sm">Firebase Error (auth/unauthorized-domain)</div>
              <div className="text-xs opacity-90 mt-0.5">
                Firebase Authentication blocks Google Sign-In popups until your preview domain is added to <strong>Authorized domains</strong>.
              </div>
            </div>
          </div>

          <div
            className="p-3 rounded-xl space-y-2 text-xs"
            style={{ backgroundColor: 'var(--m3-surface-container-low)', color: 'var(--m3-on-surface)' }}
          >
            <div className="font-bold text-xs">Domains to add in Firebase Console (without https://):</div>
            
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/10">
                <div className="min-w-0">
                  <span className="font-sans font-bold text-[10px] text-amber-500 uppercase tracking-wide block">For PC Desktop App:</span>
                  <span className="truncate block font-bold">127.0.0.1</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyDomain('127.0.0.1')}
                  className="px-2.5 py-1 rounded-md text-[10px] font-sans font-bold shrink-0 cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--m3-primary)', color: 'var(--m3-on-primary)' }}
                >
                  {copiedDomain === '127.0.0.1' ? 'Copied!' : 'Copy 127.0.0.1'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/10">
                <div className="min-w-0">
                  <span className="font-sans font-bold text-[10px] text-amber-500 uppercase tracking-wide block">For PC Localhost:</span>
                  <span className="truncate block font-bold">localhost</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyDomain('localhost')}
                  className="px-2.5 py-1 rounded-md text-[10px] font-sans font-bold shrink-0 cursor-pointer transition-colors"
                  style={{ backgroundColor: 'var(--m3-secondary-container)', color: 'var(--m3-on-secondary-container)' }}
                >
                  {copiedDomain === 'localhost' ? 'Copied!' : 'Copy localhost'}
                </button>
              </div>

              {typeof window !== 'undefined' && window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost' && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/5 dark:bg-white/10">
                  <div className="min-w-0">
                    <span className="font-sans font-bold text-[10px] opacity-75 uppercase tracking-wide block">Current Web Preview:</span>
                    <span className="truncate block">{window.location.hostname}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyDomain(window.location.hostname)}
                    className="px-2.5 py-1 rounded-md text-[10px] font-sans font-bold shrink-0 cursor-pointer transition-colors"
                    style={{ backgroundColor: 'var(--m3-surface-container-high)', color: 'var(--m3-on-surface)' }}
                  >
                    {copiedDomain === window.location.hostname ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            <div className="text-[11px] opacity-75 pt-1">
              Note: Do not paste <code>https://</code> or trailing <code>/</code> into Firebase. Only paste the raw domain name!
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <a
              href="https://console.firebase.google.com/project/gen-lang-client-0507030989/authentication/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-primary)',
                color: 'var(--m3-on-primary)',
              }}
            >
              <span>Open Firebase Settings</span>
              <ExternalLink size={13} />
            </a>

            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer underline hover:opacity-80"
            >
              Retry Sign-in
            </button>
          </div>
        </div>
      ) : statusMsg ? (
        <div
          className="p-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5"
          style={{
            backgroundColor:
              statusType === 'error'
                ? 'var(--m3-error-container)'
                : 'var(--m3-primary-container)',
            color:
              statusType === 'error'
                ? 'var(--m3-on-error-container)'
                : 'var(--m3-on-primary-container)',
          }}
        >
          {statusType === 'error' ? (
            <AlertCircle size={18} className="shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0" />
          )}
          <span>{statusMsg}</span>
        </div>
      ) : null}

      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 shadow-2xl"
            style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">
              {confirmAction === 'enableAuto'
                ? 'Enable automatic Google Drive sync?'
                : confirmAction === 'upload'
                  ? driveFile
                    ? 'Overwrite Google Drive backup?'
                    : 'Save backup to Google Drive?'
                  : 'Restore from Google Drive?'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {confirmAction === 'enableAuto'
                ? 'While you are signed in with Google, Zonein will automatically update zonein-backup.json in your Google Drive App Data folder whenever your topics, stats, customizations, or settings change.'
                : confirmAction === 'upload'
                  ? 'This will save your current topics, focus stats, wallpaper, and settings to your Google Drive app data folder.'
                  : 'This will replace your local topics, focus stats, wallpaper, and settings on this device with the backup from Google Drive.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
                style={{ color: 'var(--m3-primary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'enableAuto') {
                    setConfirmAction(null);
                    onToggleAutoSync(true);
                  } else if (confirmAction === 'upload') {
                    void handleConfirmUpload();
                  } else {
                    void handleConfirmRestore();
                  }
                }}
                className="px-5 py-2 rounded-full text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

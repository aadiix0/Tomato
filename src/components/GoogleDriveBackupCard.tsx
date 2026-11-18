import React, { useEffect, useState } from 'react';
import { Cloud, CloudDownload, CloudUpload, LogOut, RefreshCw } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  downloadDriveBackup,
  findDriveBackupFile,
  getAccessToken,
  googleSignIn,
  googleSignOut,
  initAuth,
  uploadDriveBackup,
  type DriveBackupMeta,
} from '../services/googleDriveSync';

interface GoogleDriveBackupCardProps {
  autoSync: boolean;
  lastSyncedAt: string | null;
  onToggleAutoSync: (enabled: boolean) => void;
  onSynced: (timestampIso: string) => void;
  onExportBackup: () => string;
  onImportBackup: (raw: string) => boolean;
}

export const GoogleDriveBackupCard: React.FC<GoogleDriveBackupCardProps> = ({
  autoSync,
  lastSyncedAt,
  onToggleAutoSync,
  onSynced,
  onExportBackup,
  onImportBackup,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [driveFile, setDriveFile] = useState<DriveBackupMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
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
      }
    );
    return () => unsub();
  }, []);

  const checkRemoteBackup = async (token: string) => {
    try {
      const file = await findDriveBackupFile(token);
      setDriveFile(file);
    } catch {
      // Ignore silent lookup error
    }
  };

  const handleSignIn = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      const { user: authedUser, accessToken } = await googleSignIn();
      setUser(authedUser);
      const existing = await findDriveBackupFile(accessToken);
      setDriveFile(existing);
      if (existing) {
        setStatusMsg(
          'Found an existing Tomato backup in your Google Drive. Click "Restore from Drive" to sync it to this device.'
        );
      } else {
        setStatusMsg('Connected to Google Drive. Click "Back up to Drive" to save your data.');
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmUpload = async () => {
    setConfirmAction(null);
    const token = getAccessToken();
    if (!token) {
      setStatusMsg('Session expired. Please sign in with Google again.');
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
      setStatusMsg('Backup saved to Google Drive.');
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to save backup to Google Drive.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    setConfirmAction(null);
    const token = getAccessToken();
    if (!token || !driveFile) {
      setStatusMsg('No Google Drive backup available to restore.');
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
      setStatusMsg(
        ok ? 'Restored topics, stats, and settings from Google Drive.' : 'Backup file was invalid.'
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to restore from Google Drive.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setDriveFile(null);
    setStatusMsg('Signed out of Google Drive.');
  };

  const displayLastSynced = lastSyncedAt ?? driveFile?.modifiedTime ?? null;

  return (
    <div className="space-y-3">
      <div
        className="rounded-[24px] p-5 space-y-4"
        style={{ backgroundColor: 'var(--m3-surface-bright)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Cloud size={22} style={{ color: 'var(--m3-primary)' }} />
            <div>
              <div className="font-bold">Google Drive Sync</div>
              <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Last synced:{' '}
                <span className="font-semibold">
                  {displayLastSynced ? new Date(displayLastSynced).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-sync vs Manual toggle */}
        <label
          className="flex items-center justify-between p-3.5 rounded-2xl cursor-pointer"
          style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
        >
          <div className="pr-3">
            <div className="text-sm font-semibold">Automatic Google Drive sync</div>
            <div className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {autoSync
                ? 'Automatically backs up changes while signed in'
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
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSignIn()}
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-white text-[#1f1f1f] border border-[#747775] text-sm font-semibold shadow-xs hover:bg-[#f8f9fa] transition-colors disabled:opacity-60 cursor-pointer"
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
            <span>{busy ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-3 rounded-2xl"
              style={{ backgroundColor: 'var(--m3-surface-container-low)' }}
            >
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">
                  {user.displayName || user.email}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Signed in · {autoSync ? 'Auto-sync active' : 'Manual sync'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmAction('upload')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                {busy ? <RefreshCw size={16} className="animate-spin" /> : <CloudUpload size={16} />}
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

      {statusMsg && (
        <div
          className="p-4 rounded-2xl text-sm font-semibold"
          style={{
            backgroundColor: 'var(--m3-primary-container)',
            color: 'var(--m3-on-primary-container)',
          }}
        >
          {statusMsg}
        </div>
      )}

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
                ? 'While you are signed in with Google, Tomato will automatically update tomato-backup.json in your Google Drive App Data folder whenever your topics, stats, or settings change.'
                : confirmAction === 'upload'
                  ? 'This will save your current topics, focus stats, and settings to your Google Drive app data folder.'
                  : 'This will replace your local topics, focus stats, and settings on this device with the backup from Google Drive.'}
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

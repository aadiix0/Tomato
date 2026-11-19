import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const getCurrentUser = (): User | null => auth.currentUser;

const BACKUP_FILE_NAME = 'zonein-backup.json';

export interface DriveBackupMeta {
  id: string;
  name?: string;
  modifiedTime?: string;
  size?: string;
}

export async function findDriveBackupFile(accessToken: string): Promise<DriveBackupMeta | null> {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=1`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Drive search failed (${res.status})`);
  }
  const data = (await res.json()) as { files?: DriveBackupMeta[] };
  return data.files?.[0] ?? null;
}

export async function downloadDriveBackup(
  accessToken: string,
  fileId: string
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Drive download failed (${res.status})`);
  }
  return res.text();
}

export async function uploadDriveBackup(
  accessToken: string,
  jsonContent: string,
  existingFileId?: string
): Promise<DriveBackupMeta> {
  const boundary = 'zonein_backup_boundary_314159';
  const metadata = existingFileId
    ? { name: BACKUP_FILE_NAME, mimeType: 'application/json' }
    : { name: BACKUP_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,modifiedTime,size`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Drive upload failed (${res.status})`);
  }
  return (await res.json()) as DriveBackupMeta;
}

export interface CloudSyncResult {
  status: 'restored' | 'uploaded' | 'in_sync' | 'error';
  message: string;
  file?: DriveBackupMeta | null;
  remoteData?: any;
}

/**
 * Intelligent two-way Google Drive sync:
 * - If user connects on a new PC or local is untouched: AUTO-RESTORES from Google Drive!
 * - If Google Drive has newer changes from another PC: AUTO-RESTORES!
 * - If local has newer changes: AUTO-UPLOADS to Google Drive!
 * - If in sync: Keeps both in sync.
 */
export async function syncWithGoogleDrive(
  accessToken: string,
  getLocalJson: () => string,
  localLastModified: number,
  isLocalPristine: boolean,
  onRestore: (remoteJson: string) => boolean
): Promise<CloudSyncResult> {
  try {
    const existingFile = await findDriveBackupFile(accessToken);
    if (!existingFile) {
      const saved = await uploadDriveBackup(accessToken, getLocalJson());
      return {
        status: 'uploaded',
        message: 'Initial backup uploaded to Google Drive.',
        file: saved,
      };
    }

    const remoteRaw = await downloadDriveBackup(accessToken, existingFile.id);
    let remoteParsed: any = null;
    try {
      remoteParsed = JSON.parse(remoteRaw);
    } catch {
      const saved = await uploadDriveBackup(accessToken, getLocalJson(), existingFile.id);
      return {
        status: 'uploaded',
        message: 'Replaced invalid cloud backup with local data.',
        file: saved,
      };
    }

    const remoteTimestamp =
      remoteParsed.lastModified ||
      (remoteParsed.exportedAt ? new Date(remoteParsed.exportedAt).getTime() : 0) ||
      (existingFile.modifiedTime ? new Date(existingFile.modifiedTime).getTime() : 0);

    const remoteTopicCount = Array.isArray(remoteParsed.topics) ? remoteParsed.topics.length : 0;

    // If local is pristine (brand new PC install) OR remote is newer:
    if (isLocalPristine || remoteTimestamp > localLastModified + 2000) {
      const ok = onRestore(remoteRaw);
      if (ok) {
        return {
          status: 'restored',
          message: `Auto-restored ${remoteTopicCount} topics, customizations & stats from Google Drive.`,
          file: existingFile,
          remoteData: remoteParsed,
        };
      }
    }

    // If local has newer modifications, push to Google Drive
    if (localLastModified > remoteTimestamp + 2000) {
      const saved = await uploadDriveBackup(accessToken, getLocalJson(), existingFile.id);
      return {
        status: 'uploaded',
        message: 'Updated Google Drive with latest local changes.',
        file: saved,
      };
    }

    return {
      status: 'in_sync',
      message: 'Local PC data and Google Drive are in sync.',
      file: existingFile,
      remoteData: remoteParsed,
    };
  } catch (err) {
    console.error('Google Drive sync error:', err);
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Google Drive sync failed.',
    };
  }
}

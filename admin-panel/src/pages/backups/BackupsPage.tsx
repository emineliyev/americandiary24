import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createBackup, deleteBackup, downloadBackup, fetchBackups } from '../../api/backups';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';

function formatSize(bytes: number) {
  const mib = bytes / 1024 / 1024;
  return mib >= 1024 ? `${(mib / 1024).toFixed(2)} GiB` : `${mib.toFixed(1)} MiB`;
}

export function BackupsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: backups, isLoading } = useQuery({ queryKey: ['backups'], queryFn: fetchBackups });

  async function handleCreate() {
    setCreating(true);
    try {
      await createBackup();
      toast.success('Backup created.');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to create backup.'));
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(filename: string) {
    setDownloading(filename);
    try {
      await downloadBackup(filename);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to download this backup.'));
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete(filename: string) {
    const ok = await confirm({
      message: `Delete backup "${filename}"? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBackup(filename);
      toast.success('Backup deleted.');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to delete this backup.'));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Backups</h1>
        <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : '+ Create Backup Now'}
        </button>
      </div>

      <p className="field-hint" style={{ marginBottom: 16 }}>
        Each backup is a single file containing the full database and all uploaded media. A backup also
        runs automatically every night on the server. The last 14 backups are kept; older ones are removed
        automatically.
      </p>

      {isLoading ? <p>Loading…</p> : !backups?.length ? (
        <p className="field-hint">No backups yet — click "Create Backup Now" to make the first one.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Created</th>
              <th>Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.filename}>
                <td>{b.filename}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
                <td>{formatSize(b.size_bytes)}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => handleDownload(b.filename)} disabled={downloading === b.filename}>
                    {downloading === b.filename ? 'Downloading…' : 'Download'}
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(b.filename)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

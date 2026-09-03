import json
import os
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

BACKUP_DIR = settings.BASE_DIR / 'backups'
# Local disk is the constrained resource (a growing media/ folder means
# each backup gets bigger over time) — Drive isn't, so it keeps a much
# longer history. Local only needs to cover "restore from a few days ago
# without touching the network"; Drive is the real depth-of-history copy.
LOCAL_RETENTION_COUNT = 3
DRIVE_RETENTION_COUNT = 14


def _upload_to_drive(stdout, style, archive_path, archive_name):
    """Best-effort offsite copy via rclone (a personal Google account,
    OAuth-authorized once via `rclone config` — a bare service account
    can't write to a regular/personal Drive, only to a paid-Workspace
    Shared Drive, which this project doesn't have). A failure here
    (network blip, revoked token) must never fail the backup itself,
    since the local file — the thing that actually matters for a
    restore — is already safely written by the time this runs."""
    remote_path = settings.GOOGLE_DRIVE_REMOTE_PATH
    if not remote_path:
        stdout.write('Google Drive backup not configured (GOOGLE_DRIVE_REMOTE_PATH unset) — skipping upload.')
        return

    rclone_bin = settings.RCLONE_BINARY_PATH or 'rclone'
    try:
        stdout.write('Uploading to Google Drive...')
        result = subprocess.run(
            [rclone_bin, 'copy', str(archive_path), remote_path],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            stdout.write(style.WARNING(f'Google Drive upload failed (local backup is still fine): {result.stderr}'))
            return
        stdout.write(style.SUCCESS(f'Uploaded to Google Drive: {remote_path}/{archive_name}'))

        # Mirror the local retention policy on Drive too, so the folder
        # doesn't grow forever — newest-first, keep the newest DRIVE_RETENTION_COUNT.
        listing = subprocess.run(
            [rclone_bin, 'lsjson', remote_path],
            capture_output=True, text=True,
        )
        if listing.returncode != 0:
            return
        drive_files = json.loads(listing.stdout)
        drive_files.sort(key=lambda f: f.get('ModTime', ''), reverse=True)
        for old in drive_files[DRIVE_RETENTION_COUNT:]:
            subprocess.run([rclone_bin, 'deletefile', f"{remote_path}/{old['Name']}"], capture_output=True, text=True)
            stdout.write(f'Pruned old Drive backup: {old["Name"]}')
    except FileNotFoundError:
        stdout.write(style.WARNING('rclone binary not found — skipping Drive upload.'))
    except Exception as e:
        stdout.write(style.WARNING(f'Google Drive upload failed (local backup is still fine): {e}'))


class Command(BaseCommand):
    help = (
        'Create a full site backup (database dump + media files) as a '
        'single timestamped .tar.gz in BASE_DIR/backups/, upload it to '
        'Google Drive if configured, then prune anything beyond the last '
        'LOCAL_RETENTION_COUNT backups locally and DRIVE_RETENTION_COUNT on Drive.'
    )

    def handle(self, *args, **options):
        BACKUP_DIR.mkdir(exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        archive_name = f'backup_{timestamp}.tar.gz'
        archive_path = BACKUP_DIR / archive_name

        db = settings.DATABASES['default']
        with tempfile.TemporaryDirectory() as tmpdir:
            sql_path = os.path.join(tmpdir, 'database.sql')
            env = os.environ.copy()
            if db.get('PASSWORD'):
                env['PGPASSWORD'] = db['PASSWORD']

            self.stdout.write('Dumping database...')
            result = subprocess.run(
                [
                    'pg_dump',
                    '-h', db.get('HOST') or 'localhost',
                    '-p', str(db.get('PORT') or 5432),
                    '-U', db['USER'],
                    '-d', db['NAME'],
                    '--no-owner', '--no-privileges',
                    '-f', sql_path,
                ],
                env=env, capture_output=True, text=True,
            )
            if result.returncode != 0:
                raise CommandError(f'pg_dump failed: {result.stderr}')

            self.stdout.write('Archiving database dump + media files...')
            with tarfile.open(archive_path, 'w:gz') as tar:
                tar.add(sql_path, arcname='database.sql')
                media_dir = settings.MEDIA_ROOT
                if media_dir.exists():
                    tar.add(media_dir, arcname='media')

        size_mib = archive_path.stat().st_size / 1024 / 1024
        self.stdout.write(self.style.SUCCESS(f'Backup created: {archive_name} ({size_mib:.1f} MiB)'))

        _upload_to_drive(self.stdout, self.style, archive_path, archive_name)

        backups = sorted(BACKUP_DIR.glob('backup_*.tar.gz'), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in backups[LOCAL_RETENTION_COUNT:]:
            old.unlink()
            self.stdout.write(f'Pruned old backup: {old.name}')

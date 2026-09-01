import os
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

BACKUP_DIR = settings.BASE_DIR / 'backups'
RETENTION_COUNT = 14


class Command(BaseCommand):
    help = (
        'Create a full site backup (database dump + media files) as a '
        'single timestamped .tar.gz in BASE_DIR/backups/, then prune '
        'anything beyond the last RETENTION_COUNT backups.'
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

        backups = sorted(BACKUP_DIR.glob('backup_*.tar.gz'), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in backups[RETENTION_COUNT:]:
            old.unlink()
            self.stdout.write(f'Pruned old backup: {old.name}')

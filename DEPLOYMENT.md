# Deployment Guide — AmericanDiary24

How to deploy changes from local development to production (`americandiary24.com`), and why each step exists. Read the relevant section for the kind of change you made, then run those commands on the VPS.

## Stack overview

| Piece | Where | Notes |
|---|---|---|
| Django backend | `/var/www/americandiary24/` | Served by Gunicorn (3 workers), reverse-proxied by Nginx |
| React admin panel | `/var/www/americandiary24/admin-panel/` | Built with Vite, output copied to `/var/www/americandiary24-admin-dist/` (Nginx serves this directory directly as static files — **not** the same as the source folder) |
| Database | PostgreSQL, local to the VPS | |
| Cache | Redis | Backs Django's `@cache_page` and a few manually-keyed context-processor caches (`active_categories`, `site_settings_singleton`) |
| Reverse proxy / TLS | Nginx + Let's Encrypt (Certbot) | Config: `/etc/nginx/sites-enabled/americandiary24` |
| CDN / DNS | Cloudflare (proxied, orange-cloud) | Has its own edge cache, separate from Redis |
| Domain | `americandiary24.com` (site), `admin.americandiary24.com` (admin panel) | |

Local dev: `E:\Work\Programing\Projects\Django\in_developing\americandary24\site` — Django dev server on `127.0.0.1:8001`, admin panel Vite dev server on `localhost:5173` (`npm run dev`).

## The standard git flow

Every deploy follows the same shape: commit locally → push to GitHub → `git pull` on the VPS → run whichever of the steps below apply → verify live.

```bash
# local
git add <files>
git commit -m "..."
git push origin master

# VPS
cd /var/www/americandiary24
git pull
```

Everything after `git pull` depends on **what kind of files changed** — see the sections below.

## 1. Backend changes (Python, templates, CSS/JS in `static/`)

```bash
cd /var/www/americandiary24
git pull
source .venv/bin/activate
python manage.py collectstatic --noinput
python manage.py shell -c "from django.core.cache import cache; cache.clear(); print('cache cleared')"
sudo systemctl restart gunicorn
```

- **`collectstatic`** — only strictly needed if `static/` files changed (CSS/JS/images), but harmless to run every time. It copies+hashes files into `staticfiles/`, which is what Nginx actually serves under `/static/`.
- **`cache.clear()`** — needed if you changed a **template** or **CSS/JS that a cached page references**, or any view wrapped in `@cache_page` (home, category/tag/exclusive/search pages, 2–5 min TTLs). Without this, visitors can keep seeing the old version for up to that TTL. Not needed for pure backend-logic changes with no visible-page impact (e.g. an admin-API-only fix), but it's cheap and safe to run anyway.
- **`systemctl restart gunicorn`** — needed for **any Python code change** (views, models, serializers, management commands, `settings.py`, etc.) and for template changes too (see the important gotcha below). Not needed for a CSS/JS-only change with no Python or template edits.

### Gotcha: Django caches template loaders in production

With `DEBUG=False`, Django automatically wraps template loaders with a caching loader. A template file changing on disk (`git pull`) is **not enough** — Gunicorn's already-running worker processes have the old template compiled in memory. **A Gunicorn restart is required**, not just a cache clear, whenever a `.html` template changes.

### Migrations

If a change includes a new/changed model field (a new migration file):

```bash
python manage.py migrate
```

Run this **before** restarting Gunicorn, in the same block as above (right after `collectstatic`, before the restart).

## 2. Admin panel changes (`admin-panel/`, React/TypeScript)

```bash
cd /var/www/americandiary24
git pull
cd admin-panel
npm run build
sudo rm -rf /var/www/americandiary24-admin-dist/*
sudo cp -r dist/* /var/www/americandiary24-admin-dist/
```

- The admin panel is a static build — Nginx serves `/var/www/americandiary24-admin-dist/` directly for `admin.americandiary24.com`, completely separate from the git checkout at `/var/www/americandiary24/admin-panel/`.
- **This copy step is not optional** — `npm run build` alone only updates `admin-panel/dist/` in the git checkout, which Nginx never looks at. Forgetting this step is the single most common way an admin panel deploy "does nothing" (this happened for real, more than once, this project).
- First time only, if `node`/`npm` aren't installed on the VPS: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -` then `sudo apt-get install -y nodejs`. Already done on this VPS as of Sept 2026.
- If `node_modules` is missing (fresh clone) or `package.json` changed: run `npm install` before `npm run build`.
- No Gunicorn restart needed — this is pure static file serving, unrelated to the Python process.

### Gotcha: stale Cloudflare cache after an admin panel deploy

Cloudflare edge-caches `admin.americandiary24.com` assets. If a fresh deploy doesn't appear even after confirming the file copy worked, check response headers:

```bash
curl -sI https://admin.americandiary24.com/ | grep -i cf-cache-status
```

`HIT` with an old `Last-Modified` means Cloudflare is serving a stale cached copy. Fix: Cloudflare dashboard → the domain → **Caching → Configuration → Purge Everything**.

## 3. Nginx config changes

```bash
# ALWAYS back up outside sites-enabled/ first — Nginx reads every file in
# that directory, so a .bak left inside it can cause a "duplicate server"
# error on the next reload.
sudo cp /etc/nginx/sites-enabled/americandiary24 /etc/nginx/some-backup-name.bak
# edit the file (sed, or by hand)
sudo nginx -t          # must say "syntax is ok" / "test is successful"
sudo systemctl reload nginx
```

Never `restart` Nginx for a config change — `reload` re-reads the config without dropping connections. Always run `nginx -t` before reloading; a bad config will otherwise take the whole site down.

## 4. Database backups

Built into the admin panel (Administrator role only): **Backups** page — "Create Backup Now" triggers `manage.py create_backup`, which dumps the database (`pg_dump`) and archives it with the `media/` folder into a single `.tar.gz` under `backups/` on the VPS. The last 14 are kept automatically.

Manual run from the VPS shell:

```bash
cd /var/www/americandiary24
source .venv/bin/activate
python manage.py create_backup
```

Backups live only on the VPS disk right now — **not yet copied offsite**. If the VPS disk fails, the backups fail with it. Copying backups to external storage (Google Drive / S3 / Backblaze) is a known follow-up, not yet built.

## 5. Checking for outdated dependencies

No automated reminder is set up for this (deliberately — the user preferred a manual check over a recurring cloud job). Run periodically (e.g. monthly), locally:

```bash
# Python
cd site
.venv/Scripts/python.exe -m pip install pip-audit   # if not already installed
.venv/Scripts/python.exe -m pip_audit                # checks for known CVEs
pip list --outdated                                   # checks for newer versions

# npm (admin panel)
cd site/admin-panel
npm outdated
npm audit
```

`pip-audit` and `npm audit` check for known *security* vulnerabilities specifically — worth running even if you don't intend to upgrade everything, since a flagged CVE is a stronger signal than "there's a newer version."

## 6. Quick reference — "I changed X, what do I run?"

| Changed | collectstatic | migrate | cache.clear() | gunicorn restart | npm build + copy |
|---|:-:|:-:|:-:|:-:|:-:|
| `static/css/*.css`, `static/js/*.js` | ✅ | | ✅ | | |
| `templates/**/*.html` | | | ✅ | ✅ | |
| `*/views.py`, `*/models.py`, `*/serializers.py`, management commands | | (if new migration) | (if it affects a cached page) | ✅ | |
| `config/settings.py` | | | | ✅ | |
| Anything under `admin-panel/src/` | | | | | ✅ |
| `admin-panel/public/*` (favicon etc.) | | | | | ✅ |
| Nginx config | — see §3 (its own reload, not this table) | | | | |

When in doubt, running all of §1's steps is always safe — they're idempotent.

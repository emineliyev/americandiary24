import re

from django import template
from django.utils.safestring import mark_safe

register = template.Library()

_TAG_RE = re.compile(r'<[^>]+>')


@register.filter
def reading_time(html):
    """Rough reading time estimate (200 wpm) for an article body."""
    text = _TAG_RE.sub(' ', html or '')
    words = len(text.split())
    minutes = max(1, round(words / 200))
    return f'{minutes} min read'


_A_TAG_RE = re.compile(r'<a\b([^>]*)>', re.IGNORECASE)
_HREF_RE = re.compile(r'href\s*=\s*["\']([^"\']*)["\']', re.IGNORECASE)
_TARGET_RE = re.compile(r'\btarget\s*=', re.IGNORECASE)
_REL_RE = re.compile(r'\brel\s*=\s*["\']([^"\']*)["\']', re.IGNORECASE)
_INTERNAL_MARKERS = ('americandiary24.com', 'localhost')


@register.filter
def external_links_blank(html):
    """Article bodies are legacy/CMS HTML with plain <a> tags. Outbound links
    (Truth Social, wire agencies, etc.) should open in a new tab so readers
    aren't carried off the site; links back to our own articles should not."""

    def repl(match):
        attrs = match.group(1)
        href_match = _HREF_RE.search(attrs)
        if not href_match:
            return match.group(0)

        href = href_match.group(1)
        is_internal = (
            href.startswith('/') or href.startswith('#')
            or any(marker in href for marker in _INTERNAL_MARKERS)
        )
        if is_internal:
            return match.group(0)

        if not _TARGET_RE.search(attrs):
            attrs += ' target="_blank"'

        rel_match = _REL_RE.search(attrs)
        if rel_match:
            existing = rel_match.group(1)
            missing = [w for w in ('noopener', 'noreferrer') if w not in existing]
            if missing:
                new_rel = f'{existing} {" ".join(missing)}'.strip()
                attrs = attrs[:rel_match.start()] + f'rel="{new_rel}"' + attrs[rel_match.end():]
        else:
            attrs += ' rel="noopener noreferrer"'

        return f'<a{attrs}>'

    return mark_safe(_A_TAG_RE.sub(repl, html or ''))

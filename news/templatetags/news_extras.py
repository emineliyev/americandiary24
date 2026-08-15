import re

from django import template

register = template.Library()

_TAG_RE = re.compile(r'<[^>]+>')


@register.filter
def reading_time(html):
    """Rough reading time estimate (200 wpm) for an article body."""
    text = _TAG_RE.sub(' ', html or '')
    words = len(text.split())
    minutes = max(1, round(words / 200))
    return f'{minutes} min read'

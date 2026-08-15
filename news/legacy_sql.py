"""Minimal, dependency-free parser for mysqldump-style INSERT statements.

Written specifically to read the legacy site's export (ilkx7420_amdairy.sql)
without needing a MySQL server: it walks the file character by character,
respecting standard mysqldump string escaping (\\', \\", \\\\, \\n, \\r, \\0),
so HTML-heavy article bodies with embedded quotes parse correctly.
"""

ESCAPES = {
    'n': '\n', 'r': '\r', 't': '\t', '0': '\0',
    '\\': '\\', "'": "'", '"': '"', 'Z': '\x1a',
}


def _parse_value(s, pos):
    n = len(s)
    while s[pos] in ' \t\r\n':
        pos += 1

    if s[pos] == "'":
        pos += 1
        buf = []
        while True:
            c = s[pos]
            if c == '\\':
                nc = s[pos + 1]
                buf.append(ESCAPES.get(nc, nc))
                pos += 2
                continue
            if c == "'":
                if pos + 1 < n and s[pos + 1] == "'":
                    buf.append("'")
                    pos += 2
                    continue
                pos += 1
                break
            buf.append(c)
            pos += 1
        return ''.join(buf), pos

    if s[pos:pos + 4] == 'NULL':
        return None, pos + 4

    start = pos
    while s[pos] not in ',)':
        pos += 1
    token = s[start:pos].strip()
    if token == '':
        return None, pos
    try:
        return int(token), pos
    except ValueError:
        return float(token), pos


def _parse_row(s, pos):
    assert s[pos] == '('
    pos += 1
    values = []
    while True:
        value, pos = _parse_value(s, pos)
        values.append(value)
        while s[pos] in ' \t\r\n':
            pos += 1
        if s[pos] == ',':
            pos += 1
            continue
        if s[pos] == ')':
            pos += 1
            break
    return values, pos


def iter_insert_rows(sql_text, table_name):
    """Yields one list-of-values per row for every `INSERT INTO `table_name``
    statement found in sql_text, in file order."""
    marker = f'INSERT INTO `{table_name}` ('
    search_from = 0
    while True:
        idx = sql_text.find(marker, search_from)
        if idx == -1:
            return
        pos = sql_text.find('VALUES', idx) + len('VALUES')
        while True:
            while sql_text[pos] in ' \t\r\n':
                pos += 1
            if sql_text[pos] == ';':
                pos += 1
                break
            if sql_text[pos] == ',':
                pos += 1
                continue
            if sql_text[pos] == '(':
                row, pos = _parse_row(sql_text, pos)
                yield row
            else:
                break
        search_from = pos

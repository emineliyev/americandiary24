(function () {
  'use strict';

  // Article bodies carry ad-hoc "LABEL:" + link callouts written by editors
  // over time - RELATED:, READ ALSO:, OXU BUNU:, RECOMMENDED ANALYSIS:, and
  // whatever gets written the same way in the future. Rather than hardcode
  // every label word (or even every language), this detects the shared
  // pattern instead: a short line ending in a colon, standing alone,
  // immediately followed by a link. Two source shapes both happen in
  // practice and are both handled below:
  //  1. Legacy/pasted content - label and link are separate block elements
  //     (<div>label</div><div><a>...</a></div>).
  //  2. CKEditor-authored content - label and link sit inside the SAME
  //     <p>, separated by <br> line breaks, mixed in with other text.
  // Works the same for content already in the archive and any new article
  // written the same way going forward, without touching the stored body
  // HTML.
  // \p{Lu} (Unicode "uppercase letter") rather than [A-Z] so labels in any
  // language/alphabet the CMS is used in (e.g. Azerbaijani "OXU BUNU:")
  // are recognized too, not just plain ASCII English ones. Requiring
  // all-caps (not just "any short line ending in a colon") is what keeps
  // this from also matching ordinary sentences that happen to end in one.
  var LABEL_RE = /^[\p{Lu}][\p{Lu}\s'&-]{1,40}:$/u;
  var NBSP = String.fromCharCode(160);

  function normalize(text) {
    return text.split(NBSP).join(' ').replace(/\s+/g, ' ').trim();
  }

  // Whatever target/rel the editor's pasted link happened to carry is
  // ignored on purpose - internal (this-site) links always open in the
  // same tab regardless, and external ones always open in a new one,
  // rather than trusting per-link authoring habits to get it right.
  function isInternalLink(href) {
    try {
      var url = new URL(href, window.location.href);
      var linkHost = url.hostname.replace(/^www\./i, '').toLowerCase();
      var siteHost = window.location.hostname.replace(/^www\./i, '').toLowerCase();
      return linkHost === siteHost;
    } catch (e) {
      return true; // relative/unparseable href - treat as internal
    }
  }

  function buildCallout(label, link) {
    var href = link.getAttribute('href');
    var externalAttrs = isInternalLink(href) ? '' : ' target="_blank" rel="noopener noreferrer"';
    var callout = document.createElement('div');
    callout.className = 'body-callout';
    callout.innerHTML =
      '<span class="body-callout__label">' + label.replace(/:$/, '') + '</span>' +
      '<a href="' + href + '"' + externalAttrs + '>' + normalize(link.textContent) + '</a>';
    return callout;
  }

  // ---- Shape 1: label element + link in a following sibling block ----
  function ownText(el) {
    var out = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3) out += node.textContent;
    }
    return normalize(out);
  }

  function topLevelBlock(container, el) {
    var node = el;
    while (node.parentElement && node.parentElement !== container) {
      node = node.parentElement;
    }
    return node;
  }

  function processBlockShape(body) {
    var candidates = [];
    body.querySelectorAll('*').forEach(function (el) {
      var text = ownText(el);
      if (LABEL_RE.test(text) && !el.querySelector('a[href]')) candidates.push({ el: el, label: text });
    });

    candidates.forEach(function (item) {
      var labelBlock = topLevelBlock(body, item.el);
      if (!labelBlock || !labelBlock.parentElement) return; // already handled/removed

      var toRemove = [labelBlock];
      var link = labelBlock.querySelector('a[href]');
      if (!link) {
        var next = labelBlock.nextElementSibling;
        var hops = 0;
        while (next && hops < 4) {
          toRemove.push(next);
          link = next.matches('a[href]') ? next : next.querySelector('a[href]');
          if (link) break;
          if (normalize(next.textContent)) break; // hit real content, stop
          next = next.nextElementSibling;
          hops++;
        }
      }
      if (!link) return;

      labelBlock.replaceWith(buildCallout(item.label, link));
      toRemove.slice(1).forEach(function (el) { el.remove(); });
    });
  }

  // ---- Shape 2: label + link as <br>-separated lines inside one <p> ----
  function processBrShape(body) {
    body.querySelectorAll('p, div').forEach(function (container) {
      if (!container.querySelector('br') || !container.querySelector('a[href]')) return;
      if (!container.parentElement) return; // removed by an earlier match

      var lines = [[]];
      container.childNodes.forEach(function (node) {
        if (node.nodeName === 'BR') {
          lines.push([]);
        } else {
          lines[lines.length - 1].push(node);
        }
      });

      var lineInfo = lines.map(function (nodes) {
        var text = normalize(nodes.map(function (n) { return n.textContent; }).join(''));
        var link = null;
        nodes.forEach(function (n) {
          if (link || n.nodeType !== 1) return;
          link = n.matches('a[href]') ? n : n.querySelector('a[href]');
        });
        return { nodes: nodes, text: text, link: link };
      });

      for (var i = 0; i < lineInfo.length - 1; i++) {
        if (!LABEL_RE.test(lineInfo[i].text) || lineInfo[i].link) continue;
        if (!lineInfo[i + 1].link) continue;

        var before = lineInfo.slice(0, i);
        var after = lineInfo.slice(i + 2);
        var parent = container.parentNode;

        if (before.some(function (l) { return l.text; })) {
          var beforeEl = document.createElement(container.tagName);
          before.forEach(function (l, idx) {
            if (idx > 0) beforeEl.appendChild(document.createElement('br'));
            l.nodes.forEach(function (n) { beforeEl.appendChild(n); });
          });
          parent.insertBefore(beforeEl, container);
        }

        parent.insertBefore(buildCallout(lineInfo[i].text, lineInfo[i + 1].link), container);

        if (after.some(function (l) { return l.text; })) {
          var afterEl = document.createElement(container.tagName);
          after.forEach(function (l, idx) {
            if (idx > 0) afterEl.appendChild(document.createElement('br'));
            l.nodes.forEach(function (n) { afterEl.appendChild(n); });
          });
          parent.insertBefore(afterEl, container);
        }

        parent.removeChild(container);
        return; // container is gone; re-run querySelectorAll's forEach continues safely
      }
    });
  }

  // ---- Photo credit lines: legacy content wrote these as a plain text
  // line ("Photo: Courtesy of X") in the block right after an image,
  // instead of using a real caption. CKEditor-authored articles going
  // forward use the editor's own figure/figcaption feature (styled
  // separately, see figure.image figcaption in layout.css) - this only
  // targets the legacy shape, and skips anything already inside a
  // figcaption so the two don't double-handle the same content. ----
  var PHOTO_CREDIT_RE = /^photo\s*:\s*/i;
  var CAMERA_ICON_SVG =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
    '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.3"/></svg>';

  function processPhotoCredit(body) {
    var candidates = [];
    body.querySelectorAll('*').forEach(function (el) {
      if (el.closest('figcaption')) return;
      if (el.children.length > 1 || el.querySelector('img')) return;
      if (PHOTO_CREDIT_RE.test(normalize(el.textContent))) candidates.push(el);
    });

    candidates.forEach(function (el) {
      var block = topLevelBlock(body, el);
      if (!block || !block.parentElement || block.classList.contains('body-photo-credit')) return;
      var prev = block.previousElementSibling;
      // Two legacy shapes both count: (a) the line right after an in-body
      // image, or (b) the very first line of the body with nothing before
      // it - that one's captioning the article's separate hero image
      // (.article-media, rendered above .article-body entirely), which
      // some editors credited this way instead of using the Photo Credit
      // field on the article itself.
      var captionsInBodyImage = prev && prev.querySelector('img');
      var captionsHeroImage = !prev;
      if (!captionsInBodyImage && !captionsHeroImage) return;

      // Same visual language as the hero image's own .image-credit strip
      // (icon + bold "Photo:" label) - rebuilt from the plain legacy text
      // rather than just restyled in place, since the original markup is
      // an arbitrary mix of divs/spans with no label/value split.
      var credit = normalize(el.textContent).replace(PHOTO_CREDIT_RE, '');
      block.className = 'body-photo-credit';
      block.innerHTML = CAMERA_ICON_SVG + '<strong>Photo:</strong> ' + credit;
    });
  }

  // ---- Legacy multi-author byline: a handful of older "Analysis by X, Y
  // | Americandiary24 Staff" pieces wrote the credited names as the very
  // first line of the body, instead of real author/co-author records (the
  // real byline above the body still shows the generic "Editorial" for
  // these). Deliberately only checks the body's FIRST block, not a
  // sitewide text search - "analysis by" also shows up mid-sentence in
  // ordinary, unrelated articles ("the analysis by Maxar shows..."), and
  // those must never be touched. ----
  var BYLINE_RE = /^analysis by\s*/i;

  function firstMeaningfulChild(body) {
    var child = body.firstElementChild;
    while (child && !normalize(child.textContent)) child = child.nextElementSibling;
    return child;
  }

  function joinNames(names) {
    var bold = names.map(function (n) { return '<strong>' + n + '</strong>'; });
    if (bold.length === 1) return bold[0];
    return bold.slice(0, -1).join(', ') + ' and ' + bold[bold.length - 1];
  }

  function processLegacyByline(body) {
    var first = firstMeaningfulChild(body);
    if (!first) return;
    var text = normalize(first.textContent);
    if (!BYLINE_RE.test(text)) return;

    var names = text.replace(BYLINE_RE, '').split('|')[0].split(',')
      .map(function (n) { return n.trim(); }).filter(Boolean);
    if (!names.length) return;

    first.className = 'body-byline';
    first.innerHTML = 'Analysis by ' + joinNames(names);
  }

  document.querySelectorAll('.article-body').forEach(function (body) {
    processBlockShape(body);
    processBrShape(body);
    processPhotoCredit(body);
    processLegacyByline(body);
  });
})();

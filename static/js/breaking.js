// Calibrates the homepage Breaking News ticker's scroll speed so it stays
// roughly constant (px/sec) no matter how many headlines are flagged —
// without this, a fixed animation-duration would crawl with 2 headlines and
// race with 20 (see the --ticker-duration fallback in layout.css). Pausing
// on hover/focus is handled entirely in CSS (:hover / :focus-within), so
// this script has nothing to do if it fails to load — the ticker still
// scrolls, just at the flat fallback speed.
document.addEventListener('DOMContentLoaded', function () {
  var PIXELS_PER_SECOND = 60;
  var MIN_DURATION_SECONDS = 10;

  document.querySelectorAll('.breaking-bar__ticker').forEach(function (ticker) {
    // The ticker's content is rendered twice back-to-back for a seamless
    // loop (see includes/_breaking.html) — scrollWidth covers both copies,
    // so halve it to get the distance one full loop actually travels.
    var singleCopyWidth = ticker.scrollWidth / 2;
    var duration = Math.max(singleCopyWidth / PIXELS_PER_SECOND, MIN_DURATION_SECONDS);
    ticker.style.setProperty('--ticker-duration', duration + 's');
  });
});

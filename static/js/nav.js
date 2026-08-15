(function () {
  'use strict';

  function closeAllMenus() {
    document.querySelectorAll('.nav-more.is-open').forEach(function (el) {
      el.classList.remove('is-open');
      var toggle = el.querySelector('.nav-more__toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
    var mobileMenu = document.querySelector('.mobile-menu');
    var hamburger = document.querySelector('.hamburger-toggle');
    if (mobileMenu && mobileMenu.classList.contains('is-open')) {
      mobileMenu.classList.remove('is-open');
      if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    }
  }

  // Sticky nav — appears once the hero sentinel scrolls out of view.
  var sentinel = document.querySelector('[data-sticky-sentinel]');
  var stickyNav = document.querySelector('.sticky-nav');
  if (sentinel && stickyNav && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        stickyNav.classList.toggle('is-visible', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    observer.observe(sentinel);
  }

  // "More" dropdown
  document.querySelectorAll('.nav-more').forEach(function (dropdown) {
    var toggle = dropdown.querySelector('.nav-more__toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !dropdown.classList.contains('is-open');
      closeAllMenus();
      if (willOpen) {
        dropdown.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Hamburger / mobile menu
  var hamburgerToggles = document.querySelectorAll('.hamburger-toggle');
  hamburgerToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var targetId = toggle.getAttribute('aria-controls');
      var target = targetId && document.getElementById(targetId);
      if (!target) return;
      var willOpen = !target.classList.contains('is-open');
      closeAllMenus();
      if (willOpen) {
        target.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', closeAllMenus);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllMenus();
  });
})();

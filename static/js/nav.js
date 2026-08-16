(function () {
  'use strict';

  var stickyNav = document.querySelector('.sticky-nav');
  var mobileMenu = document.querySelector('.mobile-menu');
  var lockedScrollY = 0;

  // Prevents the page behind the open mobile menu from scrolling, so touch
  // drags on the panel scroll the panel itself instead of the body.
  function lockBodyScroll() {
    lockedScrollY = window.scrollY;
    document.body.style.top = -lockedScrollY + 'px';
    document.body.classList.add('menu-open');
  }

  function unlockBodyScroll() {
    document.body.classList.remove('menu-open');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }

  function closeAllMenus() {
    document.querySelectorAll('.nav-more.is-open').forEach(function (el) {
      el.classList.remove('is-open');
      var toggle = el.querySelector('.nav-more__toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.sticky-nav__search.is-open').forEach(function (el) {
      el.classList.remove('is-open');
      var toggle = el.querySelector('.sticky-nav__search-icon');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
    if (mobileMenu && mobileMenu.classList.contains('is-open')) {
      mobileMenu.classList.remove('is-open');
      document.querySelectorAll('.hamburger-toggle').forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
      });
      unlockBodyScroll();
    }
  }

  // Sticky nav — appears once the hero sentinel scrolls out of view.
  var sentinel = document.querySelector('[data-sticky-sentinel]');
  if (sentinel && stickyNav && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        stickyNav.classList.toggle('is-visible', !entry.isIntersecting);
      });
    }, { threshold: 0 });
    observer.observe(sentinel);
  }

  // "More" dropdown (main nav + sticky nav)
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

  // Sticky nav search icon
  var stickySearch = document.querySelector('.sticky-nav__search');
  if (stickySearch) {
    var searchToggle = stickySearch.querySelector('.sticky-nav__search-icon');
    searchToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !stickySearch.classList.contains('is-open');
      closeAllMenus();
      if (willOpen) {
        stickySearch.classList.add('is-open');
        searchToggle.setAttribute('aria-expanded', 'true');
        var input = stickySearch.querySelector('input');
        if (input) input.focus();
      }
    });
    stickySearch.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  // Hamburger / mobile menu — anchored under whichever header bar is
  // currently on screen (regular header, or the fixed sticky nav).
  function anchorMobileMenu() {
    if (!mobileMenu) return;
    var offset = 0;
    if (stickyNav && stickyNav.classList.contains('is-visible')) {
      offset = stickyNav.offsetHeight;
    } else {
      ['.utility-bar', '.masthead', '.main-nav'].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) offset += el.offsetHeight;
      });
      offset -= window.scrollY;
    }
    offset = Math.max(offset, 0);
    mobileMenu.style.top = offset + 'px';
    mobileMenu.style.maxHeight = (window.innerHeight - offset) + 'px';
  }

  document.querySelectorAll('.hamburger-toggle').forEach(function (toggle) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!mobileMenu) return;
      var willOpen = !mobileMenu.classList.contains('is-open');
      closeAllMenus();
      if (willOpen) {
        anchorMobileMenu();
        mobileMenu.classList.add('is-open');
        document.querySelectorAll('.hamburger-toggle').forEach(function (btn) {
          btn.setAttribute('aria-expanded', 'true');
        });
        lockBodyScroll();
      }
    });
  });

  document.addEventListener('click', closeAllMenus);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllMenus();
  });

  // Newsletter forms — replace the native "fill out this field" browser
  // tooltip with an inline message that matches the site's own styling.
  document.querySelectorAll('form.newsletter-form').forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var error = form.querySelector('.form-error') ||
      (form.nextElementSibling && form.nextElementSibling.classList.contains('form-error') ? form.nextElementSibling : null);
    if (!input || !error) return;

    function showError(message) {
      input.classList.add('has-error');
      error.textContent = message;
      error.classList.add('is-visible');
    }
    function clearError() {
      input.classList.remove('has-error');
      error.classList.remove('is-visible');
    }

    form.addEventListener('submit', function (e) {
      if (input.validity.valueMissing) {
        e.preventDefault();
        showError('Please enter your email address.');
        input.focus();
      } else if (!input.validity.valid) {
        e.preventDefault();
        showError('Please enter a valid email address.');
        input.focus();
      } else {
        clearError();
      }
    });
    input.addEventListener('input', clearError);
  });
})();

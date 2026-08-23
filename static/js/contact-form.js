(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var fields = {
    name: { el: document.getElementById('cf-name'), validate: validateRequired, message: 'Please enter your name.' },
    email: { el: document.getElementById('cf-email'), validate: validateEmail, message: 'Please enter a valid email address.' },
    message: { el: document.getElementById('cf-message'), validate: validateRequired, message: 'Please enter a message.' },
  };

  var banner = form.querySelector('[data-role="banner"]');
  var submitBtn = form.querySelector('button[type="submit"]');

  function validateRequired(value) {
    return value.trim().length > 0;
  }

  function validateEmail(value) {
    return validateRequired(value) && EMAIL_RE.test(value.trim());
  }

  function errorEl(name) {
    return form.querySelector('[data-error-for="' + name + '"]');
  }

  function showError(name) {
    var field = fields[name];
    field.el.classList.add('has-error');
    var err = errorEl(name);
    if (err) {
      err.textContent = field.message;
      err.classList.add('is-visible');
    }
  }

  function clearError(name) {
    var field = fields[name];
    field.el.classList.remove('has-error');
    var err = errorEl(name);
    if (err) {
      err.textContent = '';
      err.classList.remove('is-visible');
    }
  }

  function validateField(name) {
    var field = fields[name];
    var valid = field.validate(field.el.value);
    if (valid) {
      clearError(name);
    } else {
      showError(name);
    }
    return valid;
  }

  // Real-time: validate on every keystroke once a field has been touched
  // (blurred at least once), so errors clear the moment they're fixed
  // instead of only re-checking on the next submit attempt.
  Object.keys(fields).forEach(function (name) {
    var el = fields[name].el;
    var touched = false;
    el.addEventListener('blur', function () {
      touched = true;
      validateField(name);
    });
    el.addEventListener('input', function () {
      if (touched) validateField(name);
    });
  });

  function setBanner(kind, text) {
    banner.textContent = text;
    banner.classList.remove('is-success', 'is-error');
    if (kind) {
      banner.classList.add('is-visible', 'is-' + kind);
    } else {
      banner.classList.remove('is-visible');
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var validNames = Object.keys(fields).filter(validateField);
    if (validNames.length !== Object.keys(fields).length) {
      var firstInvalid = Object.keys(fields).find(function (name) {
        return fields[name].el.classList.contains('has-error');
      });
      if (firstInvalid) fields[firstInvalid].el.focus();
      return;
    }

    setBanner(null, '');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch('/api/v1/public/contact/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fields.name.el.value.trim(),
        email: fields.email.el.value.trim(),
        subject: form.querySelector('#cf-subject').value.trim(),
        message: fields.message.el.value.trim(),
      }),
    })
      .then(function (response) {
        if (response.status === 201) {
          form.reset();
          Object.keys(fields).forEach(clearError);
          setBanner('success', "Thanks — your message has been sent. We'll get back to you soon.");
          return null;
        }
        if (response.status === 429) {
          setBanner('error', "You've sent too many messages recently. Please try again later.");
          return null;
        }
        return response.json().then(function (data) {
          Object.keys(data).forEach(function (name) {
            if (fields[name]) showError(name);
          });
          setBanner('error', 'Please fix the highlighted fields and try again.');
        });
      })
      .catch(function () {
        setBanner('error', 'Something went wrong. Please try again in a moment.');
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      });
  });
})();

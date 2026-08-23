import { useMemo, useState } from 'react';

export type Validator<T> = (value: any, values: T) => string | null;
export type ValidationRules<T> = Partial<Record<keyof T, Validator<T>>>;

/** Real-time client-side validation to replace the browser's native
 * required/type=email/type=url popups (which can't be styled and only
 * appear on submit) — validates as the user types/blurs instead, keyed on
 * `touched` so errors don't show up before a field has been interacted with. */
export function useFormValidation<T extends Record<string, any>>(values: T, rules: ValidationRules<T>) {
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const errors = useMemo(() => {
    const e: Partial<Record<keyof T, string>> = {};
    (Object.keys(rules) as (keyof T)[]).forEach((key) => {
      const rule = rules[key];
      if (!rule) return;
      const message = rule(values[key], values);
      if (message) e[key] = message;
    });
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, rules]);

  function touch(field: keyof T) {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  }

  function touchAll() {
    const all: Partial<Record<keyof T, boolean>> = {};
    (Object.keys(rules) as (keyof T)[]).forEach((key) => { all[key] = true; });
    setTouched(all);
  }

  function fieldError(field: keyof T): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  function fieldClass(field: keyof T): string {
    return touched[field] && errors[field] ? 'is-invalid' : '';
  }

  return { errors, touch, touchAll, fieldError, fieldClass, isValid: Object.keys(errors).length === 0 };
}

export const required = (label: string): Validator<any> => (value) => {
  if (value === null || value === undefined) return `${label} is required.`;
  if (typeof value === 'string' && value.trim() === '') return `${label} is required.`;
  if (typeof value === 'number' && value === 0) return `${label} is required.`;
  return null;
};

export const requiredHtml = (label: string): Validator<any> => (value) => {
  const text = String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text === '' ? `${label} is required.` : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const email = (label: string): Validator<any> => (value) => {
  if (!value) return null; // pair with required() for mandatory emails
  return EMAIL_RE.test(value) ? null : `${label} must be a valid email address.`;
};

const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;
export const url = (label: string): Validator<any> => (value) => {
  if (!value) return null;
  return URL_RE.test(value) ? null : `${label} must be a valid URL (starting with http:// or https://).`;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slug = (label: string): Validator<any> => (value) => {
  if (!value) return `${label} is required.`;
  return SLUG_RE.test(value) ? null : `${label} may only contain lowercase letters, numbers and hyphens.`;
};

export const minLength = (label: string, min: number): Validator<any> => (value) => {
  if (!value) return null;
  return String(value).length >= min ? null : `${label} must be at least ${min} characters.`;
};

export const exactLength = (label: string, len: number): Validator<any> => (value) => {
  if (!value) return null;
  return String(value).length === len ? null : `${label} must be exactly ${len} characters.`;
};

/** Combine multiple validators for one field — first failure wins. */
export function all<T>(...validators: Validator<T>[]): Validator<T> {
  return (value, values) => {
    for (const v of validators) {
      const msg = v(value, values);
      if (msg) return msg;
    }
    return null;
  };
}

'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  window.localStorage.setItem('theme', theme);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getPreferredTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className={['theme-toggle', className].filter(Boolean).join(' ')}
        aria-label="Toggle color theme"
        disabled
      >
        <span className="theme-toggle-icon" aria-hidden="true">
          ◐
        </span>
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={['theme-toggle', className].filter(Boolean).join(' ')}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
      <span className="theme-toggle-label">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
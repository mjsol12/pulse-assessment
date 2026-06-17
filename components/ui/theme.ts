"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "pulse-theme";
const THEME_CHANGE_EVENT = "pulse-theme-change";

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(stored) ? stored : "dark";
}

function subscribe(onStoreChange: () => void) {
  function onThemeChange() {
    onStoreChange();
  }

  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  window.addEventListener("storage", onThemeChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.removeEventListener("storage", onThemeChange);
  };
}

function getServerTheme(): Theme {
  return "dark";
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    getStoredTheme,
    getServerTheme,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(nextTheme: Theme) {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: nextTheme }));
  }

  return { theme, setTheme };
}

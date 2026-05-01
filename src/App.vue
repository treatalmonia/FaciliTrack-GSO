<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>

    <!-- Bottom Navigation Bar -->
    <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="tab.to"
        class="nav-tab"
        :class="{ 'nav-tab--active': isActive(tab) }"
      >
        <span class="nav-tab__icon" aria-hidden="true">{{ tab.icon }}</span>
        <span class="nav-tab__label">{{ tab.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { name: 'electrical', label: 'Electrical', icon: '⚡', to: '/electrical' },
  { name: 'fire-safety', label: 'Fire Safety', icon: '🧯', to: '/fire-safety' },
  { name: 'energy', label: 'Energy', icon: '📊', to: '/energy' },
]

function isActive(tab) {
  return route.path.startsWith('/' + tab.name)
}
</script>

<style>
/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL CSS RESET & BASE
───────────────────────────────────────────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  line-height: 1.5;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

button, input, select, textarea {
  font-family: inherit;
  font-size: inherit;
}

input, select, textarea {
  color: var(--text-primary);
  background: var(--bg);
}

a {
  color: inherit;
  text-decoration: none;
}

img { display: block; max-width: 100%; }

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS — CSS VARIABLES
   These are referenced by every component. Change here to retheme the whole app.
───────────────────────────────────────────────────────────────────────────── */
:root {
  /* Backgrounds */
  --bg:      #f5f6f8;        /* page background */
  --surface: #ffffff;        /* cards, modals, panels */

  /* Brand */
  --blue:       #1d6ef5;     /* primary action */
  --blue-light: #e8f0fe;     /* blue tint background */
  --blue-dark:  #1452c8;     /* pressed / hover */

  /* Semantic colors */
  --green:      #1a7f37;
  --green-light:#d4f0df;
  --yellow:     #d97706;
  --yellow-light:#fef3c7;
  --red:        #c0392b;
  --red-light:  #fee2e2;

  /* Text */
  --text-primary:   #111827;
  --text-secondary: #6b7280;
  --text-disabled:  #9ca3af;

  /* Borders & dividers */
  --border: #e5e7eb;
  --divider: #f3f4f6;

  /* Elevation */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.14);

  /* Spacing */
  --nav-height: 68px;        /* bottom nav bar height */
  --page-max:   680px;       /* max content width */
  --page-pad:   16px;        /* horizontal page padding */
}

/* ─────────────────────────────────────────────────────────────────────────────
   APP SHELL LAYOUT
───────────────────────────────────────────────────────────────────────────── */
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  /* Ensures content is never hidden behind the fixed bottom nav */
  padding-bottom: var(--nav-height);
}

/* ─────────────────────────────────────────────────────────────────────────────
   BOTTOM NAVIGATION BAR
───────────────────────────────────────────────────────────────────────────── */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--nav-height);
  background: var(--surface);
  border-top: 1.5px solid var(--border);
  display: flex;
  align-items: stretch;
  z-index: 500;

  /* Safe area for phones with home indicators (iPhone notch etc.) */
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  border: none;
  background: none;
  color: var(--text-secondary);
  text-decoration: none;

  /* Minimum 48px touch target */
  min-height: 48px;
  padding: 8px 4px;
  transition: color 0.15s;
}

.nav-tab--active {
  color: var(--blue);
}

.nav-tab__icon {
  font-size: 22px;
  line-height: 1;
}

.nav-tab__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

/* Active tab has a small indicator bar at the top */
.nav-tab--active::before {
  content: '';
  position: absolute;
  top: 0;
  width: 32px;
  height: 2.5px;
  background: var(--blue);
  border-radius: 0 0 4px 4px;
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITY CLASSES (used across all modules)
───────────────────────────────────────────────────────────────────────────── */

/* Page wrapper — use this class on the root div of every view */
.page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Back button */
.back-btn {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 600;
  color: var(--blue);
  cursor: pointer;
  padding: 8px 0;
  min-height: 48px;
  gap: 4px;
}

/* Section title */
.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

/* Section header row (title + action button side by side) */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* Generic card */
.card {
  background: var(--surface);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

/* Status badges */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.badge--green  { background: var(--green-light);  color: var(--green); }
.badge--yellow { background: var(--yellow-light); color: var(--yellow); }
.badge--red    { background: var(--red-light);    color: var(--red); }
.badge--blue   { background: var(--blue-light);   color: var(--blue); }

/* Generic primary button */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 13px 22px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-height: 48px;
  transition: background 0.15s;
}
.btn-primary:hover    { background: var(--blue-dark); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

/* Generic ghost button */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 20px;
  background: none;
  color: var(--text-primary);
  border: 2px solid var(--border);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
}

/* FAB (Floating Action Button) */
.fab {
  position: fixed;
  bottom: calc(var(--nav-height) + 16px);
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 22px;
  height: 52px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 26px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(29, 110, 245, 0.40);
  z-index: 100;
  transition: transform 0.1s, box-shadow 0.1s;
}
.fab:active {
  transform: scale(0.96);
  box-shadow: 0 2px 10px rgba(29, 110, 245, 0.30);
}

/* Loading skeleton shimmer */
.skeleton {
  background-image: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.3s infinite;
  border-radius: 10px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Error banner */
.error-banner {
  background: var(--red-light);
  color: var(--red);
  padding: 14px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  border-left: 4px solid var(--red);
}

/* Form field base styles used across all forms */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.field__req { color: var(--red); margin-left: 2px; }

.field__input,
.field__select,
.field__textarea {
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  color: var(--text-primary);
  background: var(--bg);
  width: 100%;
  box-sizing: border-box;
  min-height: 48px;
  transition: border-color 0.15s;
  appearance: auto;
}

.field__input:focus,
.field__select:focus,
.field__textarea:focus {
  outline: none;
  border-color: var(--blue);
  background: #fff;
}

.field__input:disabled,
.field__select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field__textarea {
  resize: vertical;
  min-height: 88px;
  line-height: 1.6;
}

.field__hint  { font-size: 13px; color: var(--text-secondary); }
.field__error { font-size: 13px; color: var(--red); font-weight: 600; }

/* Dialog / modal overlay */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 24px;
}

.dialog {
  background: var(--surface);
  border-radius: 18px;
  padding: 28px 24px;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: var(--shadow-lg);
  max-height: 90vh;
  overflow-y: auto;
}

.dialog__title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
}

.dialog__body {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.dialog__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.dialog__btn {
  padding: 12px 22px;
  border-radius: 10px;
  border: none;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  min-height: 48px;
  transition: opacity 0.15s;
}
.dialog__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.dialog__btn--cancel  { background: var(--bg); color: var(--text-secondary); border: 2px solid var(--border); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn--danger  { background: var(--red);  color: #fff; }

/* Vue transitions */
.dialog-enter-active,
.dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from,
.dialog-leave-to { opacity: 0; transform: scale(0.95); }

.toast-enter-active,
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
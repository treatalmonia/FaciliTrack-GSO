<template>
  <div class="app-shell" :class="{ 'app-shell--offline': !connectionStore.isOnline }">

    <!-- Offline banner -->
    <!-- <OfflineBanner /> -->

    <!-- Main content -->
    <main class="app-main">
      <RouterView />
    </main>

    <!-- ── Context-sensitive bottom nav ── -->
    <nav class="bottom-nav" role="navigation" aria-label="Main navigation">

      <!-- ELECTRICAL tabs -->
      <template v-if="currentModule === 'electrical'">
        <RouterLink to="/electrical" class="nav-tab" :class="{ 'nav-tab--active': isExact('/electrical') }">
          <span class="nav-tab__icon">🏠</span>
          <span class="nav-tab__label">Home</span>
        </RouterLink>
        <RouterLink to="/electrical/reports" class="nav-tab" :class="{ 'nav-tab--active': route.path.includes('/reports') }">
          <span class="nav-tab__icon">📋</span>
          <span class="nav-tab__label">Reports</span>
        </RouterLink>
        <RouterLink to="/electrical/new-request" class="nav-tab" :class="{ 'nav-tab--active': route.path.includes('/new-request') }">
          <span class="nav-tab__icon">➕</span>
          <span class="nav-tab__label">New Request</span>
        </RouterLink>
      </template>

      <!-- FIRE SAFETY tabs -->
      <template v-else-if="currentModule === 'fire-safety'">
        <RouterLink to="/fire-safety" class="nav-tab" :class="{ 'nav-tab--active': isExact('/fire-safety') }">
          <span class="nav-tab__icon">🏠</span>
          <span class="nav-tab__label">Home</span>
        </RouterLink>
        <RouterLink to="/fire-safety/expiry-tracker" class="nav-tab" :class="{ 'nav-tab--active': route.path.includes('/expiry-tracker') }">
          <span class="nav-tab__icon">🧯</span>
          <span class="nav-tab__label">Expiry</span>
        </RouterLink>
        <RouterLink to="/fire-safety/movement-log" class="nav-tab" :class="{ 'nav-tab--active': route.path.includes('/movement-log') }">
          <span class="nav-tab__icon">📦</span>
          <span class="nav-tab__label">Movements</span>
        </RouterLink>
        <RouterLink to="/fire-safety/bfp-report" class="nav-tab" :class="{ 'nav-tab--active': route.path.includes('/bfp-report') }">
          <span class="nav-tab__icon">📋</span>
          <span class="nav-tab__label">BFP Report</span>
        </RouterLink>
      </template>

      <!-- ENERGY tabs -->
      <template v-else-if="currentModule === 'energy'">
        <RouterLink to="/energy" class="nav-tab" :class="{ 'nav-tab--active': isExact('/energy') }">
          <span class="nav-tab__icon">🏠</span>
          <span class="nav-tab__label">Home</span>
        </RouterLink>
        <RouterLink to="/energy/enter-readings" class="nav-tab" :class="{ 'nav-tab--active': route.path.includes('/enter-readings') }">
          <span class="nav-tab__icon">⚡</span>
          <span class="nav-tab__label">Enter Readings</span>
        </RouterLink>
        <RouterLink to="/energy/history" class="nav-tab" :class="{ 'nav-tab--active': route.path.includes('/history') }">
          <span class="nav-tab__icon">📊</span>
          <span class="nav-tab__label">Reports</span>
        </RouterLink>
      </template>

      <!-- FALLBACK — module switcher (shown on root or unknown routes) -->
      <template v-else>
        <RouterLink to="/electrical" class="nav-tab" :class="{ 'nav-tab--active': route.path.startsWith('/electrical') }">
          <span class="nav-tab__icon">⚡</span>
          <span class="nav-tab__label">Electrical</span>
        </RouterLink>
        <RouterLink to="/fire-safety" class="nav-tab" :class="{ 'nav-tab--active': route.path.startsWith('/fire-safety') }">
          <span class="nav-tab__icon">🧯</span>
          <span class="nav-tab__label">Fire Safety</span>
        </RouterLink>
        <RouterLink to="/energy" class="nav-tab" :class="{ 'nav-tab--active': route.path.startsWith('/energy') }">
          <span class="nav-tab__icon">📊</span>
          <span class="nav-tab__label">Energy</span>
        </RouterLink>
      </template>

      <!-- Module switcher button — always visible, opens module picker -->
      <button
        class="nav-tab nav-tab--switch"
        :class="{ 'nav-tab--active': showModulePicker }"
        @click="showModulePicker = !showModulePicker"
      >
        <span class="nav-tab__icon">☰</span>
        <span class="nav-tab__label">Modules</span>
      </button>

      <!-- Connection dot -->
      <div
        class="connection-dot"
        :class="connectionStore.isOnline ? 'connection-dot--online' : 'connection-dot--offline'"
        :title="connectionStore.statusLabel"
      />
    </nav>

    <!-- Module picker popup -->
    <Transition name="fade">
      <div v-if="showModulePicker" class="module-picker-overlay" @click="showModulePicker = false">
        <div class="module-picker" @click.stop>
          <p class="module-picker__title">Switch Module</p>
          <button
            v-for="mod in modules"
            :key="mod.path"
            class="module-picker__btn"
            :class="{ 'module-picker__btn--active': currentModule === mod.key }"
            @click="switchModule(mod.path)"
          >
            <span class="module-picker__icon">{{ mod.icon }}</span>
            <span class="module-picker__label">{{ mod.label }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Search modal -->
    <SearchModal />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
// import OfflineBanner from '@/components/common/OfflineBanner.vue'
import SearchModal   from '@/components/common/SearchModal.vue'

const route           = useRoute()
const router          = useRouter()
const connectionStore = useConnectionStore()

const showModulePicker = ref(false)

const modules = [
  { key: 'electrical',  label: 'Electrical Repairs',  icon: '⚡', path: '/electrical'  },
  { key: 'fire-safety', label: 'Fire Safety',          icon: '🧯', path: '/fire-safety' },
  { key: 'energy',      label: 'Energy Monitoring',    icon: '📊', path: '/energy'      },
]

// Which module are we currently inside?
const currentModule = computed(() => {
  if (route.path.startsWith('/electrical'))  return 'electrical'
  if (route.path.startsWith('/fire-safety')) return 'fire-safety'
  if (route.path.startsWith('/energy'))      return 'energy'
  return null
})

function isExact(path) {
  return route.path === path
}

function switchModule(path) {
  showModulePicker.value = false
  router.push(path)
}

onMounted(() => { connectionStore.startWatching() })
onUnmounted(() => { connectionStore.stopWatching() })
</script>

<style>
/* ─── GLOBAL RESET ────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 16px; -webkit-text-size-adjust: 100%; }

body {
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  line-height: 1.5;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

button, input, select, textarea { font-family: inherit; font-size: inherit; }
input, select, textarea { color: var(--text-primary); background: var(--bg); }
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }

/* ─── DESIGN TOKENS ───────────────────────────────────────────────────────── */
:root {
  --bg:           #f5f6f8;
  --surface:      #ffffff;
  --blue:         #1d6ef5;
  --blue-light:   #e8f0fe;
  --blue-dark:    #1452c8;
  --green:        #1a7f37;
  --green-light:  #d4f0df;
  --yellow:       #d97706;
  --yellow-light: #fef3c7;
  --red:          #c0392b;
  --red-light:    #fee2e2;
  --text-primary:   #111827;
  --text-secondary: #6b7280;
  --text-disabled:  #9ca3af;
  --border:   #e5e7eb;
  --divider:  #f3f4f6;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.14);
  --nav-height: 64px;
  --page-max:   680px;
  --page-pad:   16px;
}

/* ─── APP SHELL ───────────────────────────────────────────────────────────── */
.app-shell { display: flex; flex-direction: column; min-height: 100vh; }
.app-shell--offline .app-main { padding-top: 56px; }
.app-main { flex: 1; padding-bottom: var(--nav-height); }

/* ─── BOTTOM NAV ──────────────────────────────────────────────────────────── */
.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: var(--nav-height);
  background: var(--surface);
  border-top: 1.5px solid var(--border);
  display: flex;
  align-items: stretch;
  z-index: 500;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  border: none;
  background: none;
  color: var(--text-secondary);
  text-decoration: none;
  min-height: 48px;
  padding: 6px 2px;
  transition: color 0.15s;
  position: relative;
}

.nav-tab--active { color: var(--blue); }

.nav-tab--active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 3px;
  background: var(--blue);
  border-radius: 0 0 3px 3px;
}

.nav-tab--switch { color: var(--text-disabled); }
.nav-tab--switch.nav-tab--active { color: var(--text-secondary); }

.nav-tab__icon  { font-size: 20px; line-height: 1; }
.nav-tab__label { font-size: 10px; font-weight: 700; letter-spacing: 0.01em; white-space: nowrap; }

/* Connection dot */
.connection-dot {
  position: absolute;
  top: 7px; right: 8px;
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--surface);
}
.connection-dot--online  { background: #22c55e; }
.connection-dot--offline { background: #9ca3af; }

/* ─── MODULE PICKER ───────────────────────────────────────────────────────── */
.module-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 490;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding-bottom: calc(var(--nav-height) + 8px);
  padding-right: 8px;
}

.module-picker {
  background: var(--surface);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
  box-shadow: var(--shadow-lg);
}

.module-picker__title {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 2px;
}

.module-picker__btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: none;
  border-radius: 10px;
  background: var(--bg);
  cursor: pointer;
  text-align: left;
  min-height: 52px;
  transition: background 0.1s;
}
.module-picker__btn:hover { background: var(--blue-light); }
.module-picker__btn--active { background: var(--blue-light); }

.module-picker__icon  { font-size: 22px; }
.module-picker__label { font-size: 15px; font-weight: 600; color: var(--text-primary); }

/* ─── GLOBAL UTILITIES ────────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border-radius: 14px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.section-title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
  margin: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

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
  box-shadow: 0 4px 20px rgba(29,110,245,0.40);
  z-index: 100;
  transition: transform 0.1s;
}
.fab:active { transform: scale(0.96); }

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

.error-banner {
  background: var(--red-light);
  color: var(--red);
  padding: 14px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  border-left: 4px solid var(--red);
}

/* Form fields */
.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__req   { color: var(--red); margin-left: 2px; }

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
.field__textarea:focus  { outline: none; border-color: var(--blue); background: #fff; }
.field__input:disabled,
.field__select:disabled { opacity: 0.5; cursor: not-allowed; }
.field__textarea        { resize: vertical; min-height: 88px; line-height: 1.6; }
.field__hint  { font-size: 13px; color: var(--text-secondary); }
.field__error { font-size: 13px; color: var(--red); font-weight: 600; }

/* Dialogs */
.dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000; padding: 24px;
}
.dialog {
  background: var(--surface);
  border-radius: 18px;
  padding: 28px 24px;
  width: 100%; max-width: 420px;
  display: flex; flex-direction: column; gap: 18px;
  box-shadow: var(--shadow-lg);
  max-height: 90vh; overflow-y: auto;
}
.dialog__title   { font-size: 18px; font-weight: 800; color: var(--text-primary); }
.dialog__body    { font-size: 15px; color: var(--text-secondary); line-height: 1.6; }
.dialog__actions { display: flex; gap: 10px; justify-content: flex-end; }
.dialog__btn     { padding: 12px 22px; border-radius: 10px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; min-height: 48px; }
.dialog__btn:disabled  { opacity: 0.45; cursor: not-allowed; }
.dialog__btn--cancel   { background: var(--bg); color: var(--text-secondary); border: 2px solid var(--border); }
.dialog__btn--confirm  { background: var(--blue); color: #fff; }
.dialog__btn--danger   { background: var(--red);  color: #fff; }

/* Vue transitions */
.dialog-enter-active, .dialog-leave-active         { transition: all 0.2s ease; }
.dialog-enter-from,   .dialog-leave-to             { opacity: 0; transform: scale(0.95); }
.toast-enter-active,  .toast-leave-active          { transition: all 0.25s ease; }
.toast-enter-from,    .toast-leave-to              { opacity: 0; transform: translateX(-50%) translateY(10px); }
.fade-enter-active,   .fade-leave-active           { transition: opacity 0.2s ease; }
.fade-enter-from,     .fade-leave-to               { opacity: 0; }
.offline-banner-enter-active, .offline-banner-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.offline-banner-enter-from,   .offline-banner-leave-to     { transform: translateY(-100%); opacity: 0; }
.search-modal-enter-active, .search-modal-leave-active { transition: all 0.25s ease; }
.search-modal-enter-from,   .search-modal-leave-to     { opacity: 0; transform: translateY(-16px); }
</style>
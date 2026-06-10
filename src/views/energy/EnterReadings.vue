<template>
  <div class="enter-readings-page">

    <!-- Header -->
    <header class="page-header-row">
      <div>
        <h1 class="page-title">Enter Readings</h1>
        <p class="page-subtitle">Fill in the present meter readings below.</p>
      </div>
    </header>

    <!-- ── Session Setup (shown before a session exists) ── -->
    <section v-if="!currentSession" class="session-setup card">
      <h2 class="session-setup__title">Start a New Reading Session</h2>

      <!-- Period type -->
      <div class="field">
        <label class="field__label">Period type <span class="field__req">*</span></label>
        <div class="period-btns">
          <button
            v-for="type in periodTypes"
            :key="type.value"
            class="choice-btn"
            :class="{ 'choice-btn--active': sessionForm.period_type === type.value }"
            @click="sessionForm.period_type = type.value"
          >
            {{ type.label }}
          </button>
        </div>
      </div>

      <!-- Date range -->
      <div class="date-row">
        <div class="field">
          <label class="field__label">From <span class="field__req">*</span></label>
          <input v-model="sessionForm.date_from" type="date" class="field__input" />
        </div>
        <div class="field">
          <label class="field__label">To <span class="field__req">*</span></label>
          <input v-model="sessionForm.date_to" type="date" class="field__input" :min="sessionForm.date_from" />
        </div>
      </div>

      <div class="field">
        <label class="field__label">Notes (optional)</label>
        <input v-model="sessionForm.notes" class="field__input" placeholder="e.g., April 2026 working days" />
      </div>

      <p v-if="sessionError" class="field__error">{{ sessionError }}</p>

      <button
        class="btn-primary"
        :disabled="store.loading.saveSession"
        @click="handleCreateSession"
      >
        {{ store.loading.saveSession ? 'Creating…' : 'Start Session' }}
      </button>

      <!-- Resume draft notice -->
      <div v-if="draftExists" class="draft-notice">
        <p class="draft-notice__text">
          You have an unfinished draft session. Do you want to resume it instead?
        </p>
        <button class="btn-ghost draft-notice__btn" @click="resumeDraft">
          Resume Draft
        </button>
      </div>
    </section>

    <!-- ── Active Session ── -->
    <template v-else>

      <!-- Session info bar -->
      <div class="session-bar card">
        <div class="session-bar__info">
          <span class="session-bar__type">{{ currentSession.period_type }}</span>
          <span class="session-bar__dates">
            {{ formatDate(currentSession.date_from) }} – {{ formatDate(currentSession.date_to) }}
          </span>
        </div>
        <span
          class="session-bar__status"
          :class="currentSession.status === 'Draft' ? 'status--draft' : 'status--complete'"
        >
          {{ currentSession.status }}
        </span>
      </div>

      <!-- Progress indicator -->
      <div class="progress-bar-wrap">
        <div class="progress-info">
          <span class="progress-info__text">
            {{ store.enteredCount }} of {{ store.totalMeterCount }} readings entered
          </span>
          <span v-if="store.warningEntries.length" class="progress-info__warning">
            ⚠ {{ store.warningEntries.length }} warning{{ store.warningEntries.length > 1 ? 's' : '' }}
          </span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-bar__fill"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
      </div>

      <!-- Live total -->
      <div class="live-total card">
        <span class="live-total__label">Total campus consumption this session</span>
        <span class="live-total__kwh">{{ formatKwh(liveTotal) }} kWh</span>
      </div>

      <!-- ── Meter Reading Entries ── -->
      <div v-if="store.loading.entries" class="skeleton-list">
        <div v-for="n in 5" :key="n" class="skeleton" style="height: 100px" />
      </div>

      <div v-else class="entries-list">
        <div
          v-for="(row, idx) in entryRows"
          :key="row.entry_id"
          class="entry-card card"
          :class="{
            'entry-card--entered':  row.isEntered,
            'entry-card--warning':  row.hasWarning,
          }"
        >
          <!-- Meter identity -->
          <div class="entry-card__header">
            <div>
              <span class="entry-card__area">{{ row.area_name }}</span>
              <span class="entry-card__meter-num">Meter {{ row.meter_number }}</span>
            </div>
            <span v-if="row.isEntered" class="entry-entered-badge">✓ Entered</span>
          </div>

          <!-- Previous reading (grayed, auto-filled) -->
          <div class="entry-card__prev">
            <span class="entry-card__prev-label">Previous reading</span>
            <span class="entry-card__prev-value">{{ formatReading(row.previous_reading) }}</span>
          </div>

          <!-- Present reading input -->
          <div class="field">
            <label class="field__label" :for="`entry-${row.entry_id}`">
              Present reading
            </label>
            <input
              :id="`entry-${row.entry_id}`"
              v-model="localReadings[row.entry_id]"
              type="number"
              inputmode="numeric"
              class="field__input entry-input"
              :class="{ 'entry-input--warning': row.hasWarning }"
              placeholder="Enter present reading"
              step="0.01"
              min="0"
              @input="onReadingInput(row, idx)"
              @keydown.tab.prevent="focusNext(idx)"
            />
          </div>

          <!-- Warning message -->
          <div v-if="row.hasWarning" class="entry-warning">
            <span class="entry-warning__icon">⚠</span>
            <span>{{ row.warning_note }}</span>
          </div>

          <!-- Live computed consumption -->
          <div v-if="row.isEntered && !row.hasWarning" class="entry-consumption">
            <span>Raw: <strong>{{ formatReading(row.raw_consumption) }} kWh</strong></span>
            <span>×{{ row.multiplier }}</span>
            <span>Actual: <strong class="text-blue">{{ formatKwh(row.actual_kwh) }} kWh</strong></span>
          </div>

          <!-- Warning: require note before save -->
          <div v-if="row.hasWarning" class="field" style="margin-top: 8px">
            <label class="field__label">
              Reason for lower reading
              <span class="field__req">*</span>
            </label>
            <input
              v-model="warningNotes[row.entry_id]"
              class="field__input"
              placeholder="e.g., Meter reset, read error"
            />
          </div>
        </div>
      </div>

      <!-- ── Action buttons ── -->
      <div class="action-btns" v-if="currentSession.status === 'Draft'">
        <!-- Save Draft (partial save) -->
        <button
          class="btn-ghost save-draft-btn"
          :disabled="store.loading.saveEntry"
          @click="handleSaveDraft"
        >
          {{ store.loading.saveEntry ? 'Saving…' : '💾 Save Draft' }}
        </button>

        <!-- Save All Readings -->
        <button
          class="btn-primary save-all-btn"
          :disabled="store.loading.saveEntry || !hasAnyReading"
          @click="handleSaveAll"
        >
          {{ store.loading.saveEntry ? 'Saving…' : 'Save All Readings' }}
        </button>
      </div>

      <!-- Complete session button — shown after Save All -->
      <div v-if="allEntriesSaved && currentSession.status === 'Draft'" class="complete-section">
        <div v-if="missingMeters.length" class="missing-warning">
          <p class="missing-warning__title">
            Report cannot be generated yet — {{ missingMeters.length }} meter{{ missingMeters.length > 1 ? 's' : '' }} missing:
          </p>
          <ul class="missing-warning__list">
            <li v-for="name in missingMeters" :key="name">{{ name }}</li>
          </ul>
        </div>

        <button
          v-else
          class="btn-primary complete-btn"
          :disabled="store.loading.completeSession"
          @click="handleComplete"
        >
          {{ store.loading.completeSession ? 'Saving…' : '✓ Mark Session as Complete' }}
        </button>
      </div>

      <!-- Session already complete notice -->
      <div v-if="currentSession.status === 'Complete'" class="complete-notice card">
        <span class="complete-notice__icon">✓</span>
        <div>
          <p class="complete-notice__title">This session is complete.</p>
          <p class="complete-notice__sub">
            Total: <strong>{{ formatKwh(currentSession.total_kwh) }} kWh</strong>
          </p>
        </div>
        <button class="btn-ghost" @click="startNewSession">Start New Session</button>
      </div>

    </template>

    <ToastNotification
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @done="toast.show = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useEnergyStore } from '@/stores/energy'
import ToastNotification from '@/components/common/ToastNotification.vue'

const store = useEnergyStore()

const todayStr = new Date().toISOString().split('T')[0]

const periodTypes = [
  { value: 'Monthly',          label: 'Monthly' },
  { value: 'Working Days',     label: 'Working Days' },
  { value: 'Non-Working Days', label: 'Non-Working Days' },
]

// ── Session setup form ────────────────────────────────────────────────────
const sessionError = ref('')
const draftExists  = ref(false)
const sessionForm  = ref({
  period_type: 'Monthly',
  date_from:   todayStr,
  date_to:     todayStr,
  notes:       '',
})

// ── Current session ───────────────────────────────────────────────────────
const currentSession = computed(() => store.currentSession)

// ── Local readings (reactive input values keyed by entry_id) ──────────────
const localReadings  = ref({})   // { entry_id: string }
const warningNotes   = ref({})   // { entry_id: string } — required when has_warning

// ── Entry rows — merge store entries with local input values ──────────────
const entryRows = computed(() =>
  store.entries.map((entry) => {
    const localVal  = localReadings.value[entry.entry_id]
    const present   = localVal !== undefined ? parseFloat(localVal) : parseFloat(entry.present_reading)
    const previous  = parseFloat(entry.previous_reading) || 0
    const mult      = entry.meter?.multiplier ?? 1
    const raw       = present - previous
    const kwh       = raw * mult
    const isEntered = localVal !== undefined && localVal !== ''
    const hasWarn   = isEntered && present < previous

    return {
      entry_id:        entry.entry_id,
      meter_id:        entry.meter_id,
      meter_number:    entry.meter?.meter_number,
      area_name:       entry.meter?.area_name ?? '—',
      multiplier:      mult,
      previous_reading: previous,
      present_reading:  present,
      raw_consumption:  parseFloat(raw.toFixed(2)),
      actual_kwh:       parseFloat(kwh.toFixed(2)),
      has_warning:      entry.has_warning,
      warning_note:     entry.warning_note,
      isEntered,
      hasWarning: hasWarn,
    }
  })
)

// ── Live total (sum of all computed actual_kwh in localReadings) ──────────
const liveTotal = computed(() =>
  entryRows.value.reduce((sum, row) => {
    if (!row.isEntered) return sum
    return sum + (row.actual_kwh || 0)
  }, 0)
)

// ── Progress ──────────────────────────────────────────────────────────────
const progressPercent = computed(() => {
  if (!store.totalMeterCount) return 0
  return Math.round((store.enteredCount / store.totalMeterCount) * 100)
})

const hasAnyReading = computed(() =>
  Object.values(localReadings.value).some((v) => v !== '' && v !== undefined)
)

const allEntriesSaved = computed(() =>
  store.enteredCount === store.totalMeterCount && store.totalMeterCount > 0
)

const missingMeters = computed(() => store.getMissingMeters())

// ── Input handler — live compute per keystroke ────────────────────────────
// function onReadingInput(row, idx) {
//   // Local reactive update — actual DB save happens on Save button
// }

// ── Tab to next meter ─────────────────────────────────────────────────────
async function focusNext(currentIdx) {
  const nextIdx = currentIdx + 1
  if (nextIdx >= entryRows.value.length) return
  await nextTick()
  const nextEntry = entryRows.value[nextIdx]
  const el = document.getElementById(`entry-${nextEntry.entry_id}`)
  if (el) el.focus()
}

// ── Create session ────────────────────────────────────────────────────────
async function handleCreateSession() {
  sessionError.value = ''
  if (!sessionForm.value.period_type) { sessionError.value = 'Please select a period type.'; return }
  if (!sessionForm.value.date_from)   { sessionError.value = 'Please select a start date.'; return }
  if (!sessionForm.value.date_to)     { sessionError.value = 'Please select an end date.'; return }
  if (sessionForm.value.date_to < sessionForm.value.date_from) {
    sessionError.value = 'End date cannot be before start date.'
    return
  }

  const result = await store.createSession(sessionForm.value)
  if (!result) {
    sessionError.value = store.error.saveSession ?? 'Failed to create session.'
  }
}

async function resumeDraft() {
  await store.fetchDraftSession(sessionForm.value.period_type)
}

function startNewSession() {
  store.currentSession = null
  store.entries = []
  localReadings.value = {}
  warningNotes.value  = {}
}

// ── Save draft (partial — whatever is entered so far) ─────────────────────
async function handleSaveDraft() {
  await saveEntriesToDB()
  toast.value = { show: true, message: 'Draft saved.', type: 'success' }
}

// ── Save all readings ─────────────────────────────────────────────────────
async function handleSaveAll() {
  // Validate: warning entries must have a reason note
  const missingReasons = entryRows.value.filter(
    (row) => row.hasWarning && !warningNotes.value[row.entry_id]?.trim()
  )
  if (missingReasons.length) {
    toast.value = {
      show: true,
      message: `Please enter a reason for the ${missingReasons.length} lower reading(s) before saving.`,
      type: 'error',
    }
    return
  }

  const result = await saveEntriesToDB()
  if (result) {
    toast.value = { show: true, message: 'All readings saved.', type: 'success' }
  }
}

async function saveEntriesToDB() {
  const payloads = entryRows.value
    .filter((row) => row.isEntered)
    .map((row) => ({
      entry_id:         row.entry_id,
      meter_id:         row.meter_id,
      present_reading:  row.present_reading,
      previous_reading: row.previous_reading,
      multiplier:       row.multiplier,
      warning_note:     row.hasWarning ? warningNotes.value[row.entry_id] : null,
    }))

  if (!payloads.length) return null
  return await store.saveAllEntries(payloads)
}

// ── Complete session ──────────────────────────────────────────────────────
async function handleComplete() {
  const result = await store.completeSession(currentSession.value.session_id)
  if (result) {
    toast.value = { show: true, message: 'Session marked as complete.', type: 'success' }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
const toast = ref({ show: false, message: '', type: 'success' })

function formatKwh(val) {
  const n = parseFloat(val) || 0
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatReading(val) {
  const n = parseFloat(val) || 0
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ── Init ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!store.meters.length) await store.fetchMeters()

  // Check for existing draft session
  const draft = await store.fetchDraftSession('Monthly')
  draftExists.value = !!draft

  // Pre-fill localReadings from any already-saved entries
  if (draft) {
    for (const entry of store.entries) {
      if (parseFloat(entry.present_reading) > 0) {
        localReadings.value[entry.entry_id] = String(entry.present_reading)
      }
    }
  }
})
</script>

<style scoped>
.enter-readings-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header-row { display: flex; justify-content: space-between; align-items: flex-start; }
.page-title      { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.page-subtitle   { font-size: 14px; color: var(--text-secondary); margin-top: 2px; }

/* Session setup */
.session-setup { display: flex; flex-direction: column; gap: 16px; padding: 24px; }
.session-setup__title { font-size: 18px; font-weight: 800; color: var(--text-primary); margin: 0; }

.period-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.choice-btn {
  padding: 10px 16px; border: 2px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text-primary); font-size: 14px;
  font-weight: 600; cursor: pointer; min-height: 48px;
}
.choice-btn--active { border-color: var(--blue); background: var(--blue-light); color: var(--blue); }

.date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* Draft notice */
.draft-notice {
  background: var(--yellow-light);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.draft-notice__text { font-size: 14px; color: var(--text-primary); margin: 0; line-height: 1.5; }
.draft-notice__btn  { align-self: flex-start; padding: 10px 18px; font-size: 14px; }

/* Session bar */
.session-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  gap: 12px;
}
.session-bar__info  { display: flex; flex-direction: column; gap: 2px; }
.session-bar__type  { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.session-bar__dates { font-size: 13px; color: var(--text-secondary); }

.status--draft    { font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 20px; background: var(--yellow-light); color: var(--yellow); }
.status--complete { font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 20px; background: var(--green-light); color: var(--green); }

/* Progress bar */
.progress-bar-wrap { display: flex; flex-direction: column; gap: 8px; }
.progress-info { display: flex; justify-content: space-between; align-items: center; }
.progress-info__text    { font-size: 14px; font-weight: 600; color: var(--text-secondary); }
.progress-info__warning { font-size: 13px; font-weight: 700; color: var(--yellow); }

.progress-bar {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar__fill {
  height: 100%;
  background: var(--blue);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Live total */
.live-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
}
.live-total__label { font-size: 14px; color: var(--text-secondary); }
.live-total__kwh   { font-size: 20px; font-weight: 900; color: var(--blue); }

/* Entry cards */
.entries-list { display: flex; flex-direction: column; gap: 10px; }

.entry-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-left: 4px solid transparent;
  transition: border-color 0.15s;
}
.entry-card--entered { border-left-color: var(--green); }
.entry-card--warning { border-left-color: var(--yellow); background: #fffdf0; }

.entry-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.entry-card__area       { display: block; font-size: 16px; font-weight: 700; color: var(--text-primary); }
.entry-card__meter-num  { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.entry-entered-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--green-light);
  color: var(--green);
  flex-shrink: 0;
}

.entry-card__prev {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg);
  border-radius: 6px;
  padding: 8px 12px;
}
.entry-card__prev-label { font-weight: 600; }
.entry-card__prev-value { font-family: monospace; font-size: 14px; }

.entry-input {
  font-size: 20px;
  font-weight: 700;
  text-align: right;
  padding: 14px;
  min-height: 56px;
  letter-spacing: 0.02em;
}
.entry-input--warning {
  border-color: var(--yellow) !important;
  background: #fffdf0;
}

.entry-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--yellow);
  line-height: 1.5;
}
.entry-warning__icon { font-size: 16px; flex-shrink: 0; }

.entry-consumption {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg);
  padding: 8px 12px;
  border-radius: 6px;
}

/* Action buttons */
.action-btns {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.save-draft-btn { width: 100%; padding: 13px; }
.save-all-btn   { width: 100%; }

/* Missing meters warning */
.missing-warning {
  background: var(--red-light);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.missing-warning__title { font-size: 14px; font-weight: 700; color: var(--red); margin: 0; }
.missing-warning__list  { font-size: 13px; color: var(--red); padding-left: 20px; margin: 0; }

/* Complete section */
.complete-section { display: flex; flex-direction: column; gap: 12px; }
.complete-btn     { width: 100%; }

/* Complete notice */
.complete-notice {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  flex-wrap: wrap;
}
.complete-notice__icon  { font-size: 32px; color: var(--green); flex-shrink: 0; }
.complete-notice__title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; }
.complete-notice__sub   { font-size: 14px; color: var(--text-secondary); margin: 4px 0 0; }

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 10px; }

/* Utility */
.text-blue { color: var(--blue); }

/* Fields */
.field       { display: flex; flex-direction: column; gap: 6px; }
.field__label{ font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__req  { color: var(--red); }
.field__input{
  padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px;
  font-size: 15px; min-height: 48px; width: 100%; box-sizing: border-box;
  background: var(--bg); color: var(--text-primary);
}
.field__input:focus { outline: none; border-color: var(--blue); }
.field__error{ font-size: 13px; color: var(--red); font-weight: 600; }
</style>
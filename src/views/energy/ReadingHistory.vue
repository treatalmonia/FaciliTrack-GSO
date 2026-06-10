<template>
  <div class="history-page">

    <header class="history-header">
      <h1 class="history-header__title">Energy Reports</h1>
      <p class="history-header__subtitle">Monthly and period reading summaries</p>
    </header>

    <!-- Report type tabs -->
    <div class="tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab"
        :class="{ 'tab--active': activeTab === tab.value }"
        role="tab"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Date range selector -->
    <div class="date-filter card">
      <template v-if="activeTab === 'Monthly'">
        <div class="field">
          <label class="field__label">Month</label>
          <select v-model="selectedMonth" class="field__select">
            <option v-for="m in monthOptions" :key="m.value" :value="m.value">
              {{ m.label }}
            </option>
          </select>
        </div>
      </template>
      <template v-else>
        <div class="date-row">
          <div class="field">
            <label class="field__label">From</label>
            <input v-model="dateFrom" type="date" class="field__input" />
          </div>
          <div class="field">
            <label class="field__label">To</label>
            <input v-model="dateTo" type="date" class="field__input" />
          </div>
        </div>
      </template>

      <button
        class="btn-primary generate-btn"
        :disabled="store.loading.sessions"
        @click="loadReport"
      >
        {{ store.loading.sessions ? 'Loading…' : 'Load Report' }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading.entries" class="skeleton-list">
      <div v-for="n in 3" :key="n" class="skeleton" style="height: 100px" />
    </div>

    <!-- Error -->
    <div v-else-if="fetchError" class="error-banner">{{ fetchError }}</div>

    <!-- Report content -->
    <template v-else-if="reportSession">

      <!-- Print bar -->
      <div class="print-bar no-print">
        <span class="print-bar__hint">Ready to print and sign.</span>
        <button class="btn-ghost print-btn" @click="window.print()">
          🖨 Print Report
        </button>
      </div>

      <!-- ══ PRINTABLE AREA ══ -->
      <div class="report-body" id="energy-print-area">

        <!-- Letterhead -->
        <div class="report-letterhead">
          <p class="report-letterhead__org">Caraga State University</p>
          <p class="report-letterhead__dept">General Services Office — Energy Section</p>
          <h2 class="report-letterhead__title">{{ reportTitle }}</h2>
          <p class="report-letterhead__period">
            {{ formatDate(reportSession.date_from) }} – {{ formatDate(reportSession.date_to) }}
          </p>
        </div>

        <!-- Missing meters blocker -->
        <div v-if="missingInReport.length" class="missing-block no-print">
          <p class="missing-block__title">
            ⚠ {{ missingInReport.length }} meter{{ missingInReport.length > 1 ? 's' : '' }}
            have no reading for this period:
          </p>
          <ul class="missing-block__list">
            <li v-for="name in missingInReport" :key="name">
              {{ name }}
              <RouterLink
                :to="{ name: 'EnterReadings' }"
                class="missing-block__link"
              >Enter reading →</RouterLink>
            </li>
          </ul>
        </div>

        <!-- Main reading table -->
        <section class="report-section">
          <h3 class="report-section__title">Meter Readings</h3>

          <div class="report-table-wrap">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Meter No.</th>
                  <th>Area</th>
                  <th class="text-right">Previous Reading</th>
                  <th class="text-right">Present Reading</th>
                  <th class="text-right">Raw kWh</th>
                  <th class="text-right">Multiplier</th>
                  <th class="text-right">Actual kWh</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in reportEntries"
                  :key="entry.entry_id"
                  :class="{ 'row--warning': entry.has_warning }"
                >
                  <td class="text-center">{{ entry.meter?.meter_number }}</td>
                  <td class="text-bold">{{ entry.meter?.area_name ?? '—' }}</td>
                  <td class="text-right font-mono">{{ formatReading(entry.previous_reading) }}</td>
                  <td class="text-right font-mono">{{ formatReading(entry.present_reading) }}</td>
                  <td class="text-right font-mono">{{ formatReading(entry.raw_consumption) }}</td>
                  <td class="text-center">× {{ entry.meter?.multiplier ?? 1 }}</td>
                  <td class="text-right font-mono font-bold text-blue">
                    {{ formatKwh(entry.actual_kwh) }}
                  </td>
                  <td class="text-sm text-secondary">
                    <span v-if="entry.has_warning" class="warn-flag">⚠</span>
                    {{ entry.warning_note ?? '' }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="font-bold text-right">TOTAL kWh</td>
                  <td class="text-right font-bold text-blue total-kwh">
                    {{ formatKwh(reportSession.total_kwh) }}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <!-- Working vs Non-Working comparison (if Monthly tab) -->
        <section v-if="activeTab === 'Monthly' && wvnw" class="report-section">
          <h3 class="report-section__title">Working vs. Non-Working Days Comparison</h3>
          <div class="wvnw-report-grid">
            <div class="wvnw-report-stat">
              <p class="wvnw-report-stat__label">Working Days</p>
              <p class="wvnw-report-stat__kwh">{{ formatKwh(wvnw.workingKwh) }} kWh</p>
              <p class="wvnw-report-stat__detail">
                {{ wvnw.workingDays }} days · {{ wvnw.workingDaily }} kWh/day
              </p>
            </div>
            <div class="wvnw-report-stat">
              <p class="wvnw-report-stat__label">Non-Working Days</p>
              <p class="wvnw-report-stat__kwh">{{ formatKwh(wvnw.nonWorkingKwh) }} kWh</p>
              <p class="wvnw-report-stat__detail">
                {{ wvnw.nonWorkingDays }} days · {{ wvnw.nonWorkingDaily }} kWh/day
              </p>
            </div>
          </div>
          <p class="wvnw-insight">💡 {{ wvnw.insight }}</p>
        </section>

        <!-- Signature lines -->
        <div class="signatures">
          <div class="signature-block">
            <div class="signature-block__line" />
            <p class="signature-block__name">Engr. Rogelio B. Gonzales Jr.</p>
            <p class="signature-block__role">Electrical Engineer, GSO</p>
            <p class="signature-block__label">Prepared by</p>
          </div>
          <div class="signature-block">
            <div class="signature-block__line" />
            <p class="signature-block__name">Engr. Mariel M. Delo</p>
            <p class="signature-block__role">Director, GSO</p>
            <p class="signature-block__label">Noted by</p>
          </div>
        </div>

        <p class="report-footer">
          Generated {{ formatDate(todayStr) }} · FaciliTrack GSO · Energy Module
        </p>

      </div>
      <!-- end .report-body -->

    </template>

    <!-- Initial prompt -->
    <div v-else class="empty-prompt">
      <span class="empty-prompt__icon">📊</span>
      <p class="empty-prompt__text">
        Select a period above and tap <strong>Load Report</strong>.
      </p>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useEnergyStore } from '@/stores/energy'
import { supabase } from '@/lib/supabase'

const store    = useEnergyStore()
const todayStr = new Date().toISOString().split('T')[0]

// ── Tabs ──────────────────────────────────────────────────────────────────
const tabs = [
  { value: 'Monthly',          label: 'Monthly Report' },
  { value: 'Working Days',     label: 'Working Days' },
  { value: 'Non-Working Days', label: 'Non-Working Days' },
]
const activeTab = ref('Monthly')

// ── Date selectors ────────────────────────────────────────────────────────
const today        = new Date()
const selectedMonth = ref(
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
)
const dateFrom = ref(todayStr)
const dateTo   = ref(todayStr)

const monthOptions = computed(() => {
  const opts = []
  const d    = new Date()
  for (let i = 0; i < 24; i++) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    opts.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
    })
    d.setMonth(d.getMonth() - 1)
  }
  return opts
})

// ── Report state ──────────────────────────────────────────────────────────
const reportSession = ref(null)
const reportEntries = ref([])
const fetchError    = ref(null)

const reportTitle = computed(() => {
  const map = {
    'Monthly':          'Monthly Electricity Consumption Report',
    'Working Days':     'Working Days Electricity Consumption Report',
    'Non-Working Days': 'Non-Working Days Electricity Consumption Report',
  }
  return map[activeTab.value]
})

// ── Load report ───────────────────────────────────────────────────────────
async function loadReport() {
  fetchError.value    = null
  reportSession.value = null
  reportEntries.value = []

  let from, to
  if (activeTab.value === 'Monthly') {
    const [y, m] = selectedMonth.value.split('-').map(Number)
    from = `${y}-${String(m).padStart(2, '0')}-01`
    to   = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`
  } else {
    from = dateFrom.value
    to   = dateTo.value
  }

  try {
    // Find the session matching period_type + date range
    const { data: sessionData, error: sErr } = await supabase
      .from('meter_reading_session')
      .select('*')
      .eq('period_type', activeTab.value)
      .gte('date_from', from)
      .lte('date_to', to)
      .eq('status', 'Complete')
      .order('date_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sErr) throw sErr

    if (!sessionData) {
      fetchError.value = `No complete session found for this period. Make sure readings have been entered and marked as complete.`
      return
    }

    reportSession.value = sessionData

    // Load entries for this session
    const { data: entryData, error: eErr } = await supabase
      .from('meter_reading_entry')
      .select(`
        entry_id, session_id, meter_id,
        previous_reading, present_reading,
        raw_consumption, actual_kwh,
        has_warning, warning_note,
        meter:meter_id ( meter_id, meter_number, area_name, multiplier )
      `)
      .eq('session_id', sessionData.session_id)
      .order('meter_id', { ascending: true })

    if (eErr) throw eErr
    reportEntries.value = entryData ?? []

    // Refresh latest sessions for comparison
    await store.fetchLatestSessions()
  } catch (err) {
    fetchError.value = `Failed to load report: ${err.message}`
    console.error('[ReadingHistory] loadReport:', err)
  }
}

// ── Missing meters check ──────────────────────────────────────────────────
const missingInReport = computed(() => {
  if (!reportSession.value) return []
  const enteredIds = new Set(reportEntries.value.map((e) => e.meter_id))
  return store.activeMeters
    .filter((m) => !enteredIds.has(m.meter_id))
    .map((m) => m.area_name)
})

// ── Working vs Non-Working ────────────────────────────────────────────────
const wvnw = computed(() => store.getWorkingVsNonWorking())

// ── Helpers ───────────────────────────────────────────────────────────────
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

onMounted(async () => {
  await Promise.all([
    store.fetchMeters(),
    store.fetchLatestSessions(),
  ])
})
</script>

<style scoped>
.history-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.history-header__title    { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.history-header__subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 2px; }

/* Tabs */
.tabs { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab {
  flex-shrink: 0; padding: 10px 18px;
  border: 2px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text-secondary);
  font-size: 14px; font-weight: 600; cursor: pointer;
  min-height: 48px; white-space: nowrap; transition: all 0.15s;
}
.tab--active { border-color: var(--blue); background: var(--blue); color: #fff; }

/* Date filter */
.date-filter { display: flex; flex-direction: column; gap: 14px; padding: 20px; }
.date-row    { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.generate-btn { width: 100%; }

/* Print bar */
.print-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.print-bar__hint { font-size: 14px; color: var(--text-secondary); }
.print-btn { padding: 10px 20px; font-size: 14px; font-weight: 700; }

/* Report body */
.report-body {
  background: var(--surface);
  border-radius: 14px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  box-shadow: var(--shadow-sm);
}

/* Letterhead */
.report-letterhead { text-align: center; border-bottom: 2px solid var(--border); padding-bottom: 20px; }
.report-letterhead__org   { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.report-letterhead__dept  { font-size: 13px; color: var(--text-secondary); }
.report-letterhead__title { font-size: 20px; font-weight: 800; color: var(--text-primary); margin-top: 10px; }
.report-letterhead__period{ font-size: 14px; color: var(--text-secondary); margin-top: 4px; }

/* Missing meters */
.missing-block {
  background: var(--red-light);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.missing-block__title { font-size: 14px; font-weight: 700; color: var(--red); margin: 0; }
.missing-block__list  { font-size: 13px; color: var(--red); padding-left: 20px; margin: 0; }
.missing-block__link  { color: var(--blue); font-weight: 600; margin-left: 8px; }

/* Report section */
.report-section { display: flex; flex-direction: column; gap: 14px; }
.report-section__title {
  font-size: 14px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-primary);
  padding-bottom: 8px; border-bottom: 1.5px solid var(--border);
}

/* Report table */
.report-table-wrap { overflow-x: auto; }
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 600px;
}
.report-table th {
  padding: 8px 10px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border);
  white-space: nowrap;
}
.report-table td {
  padding: 10px 10px;
  border-bottom: 1px solid var(--divider);
  vertical-align: middle;
  color: var(--text-primary);
}
.report-table tfoot td {
  border-top: 2px solid var(--border);
  border-bottom: none;
  padding-top: 12px;
  font-size: 15px;
}
.report-table .row--warning td { background: #fffdf0; }

.total-kwh { font-size: 18px; }
.warn-flag { color: var(--yellow); margin-right: 4px; }

/* Working vs Non-Working in report */
.wvnw-report-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.wvnw-report-stat {
  background: var(--bg);
  border-radius: 10px;
  padding: 16px;
  border: 1.5px solid var(--border);
}
.wvnw-report-stat__label  { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin: 0 0 6px; }
.wvnw-report-stat__kwh    { font-size: 22px; font-weight: 900; color: var(--text-primary); margin: 0; }
.wvnw-report-stat__detail { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }

.wvnw-insight {
  font-size: 14px; color: var(--text-secondary); line-height: 1.6;
  background: var(--bg); border-radius: 8px; padding: 12px 14px; margin: 0;
}

/* Signatures */
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding-top: 16px; border-top: 1.5px solid var(--border); }
.signature-block { display: flex; flex-direction: column; gap: 5px; }
.signature-block__line  { height: 1px; background: var(--text-primary); margin-bottom: 8px; margin-top: 40px; }
.signature-block__name  { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.signature-block__role  { font-size: 13px; color: var(--text-secondary); }
.signature-block__label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }

.report-footer { font-size: 12px; color: var(--text-secondary); text-align: center; }

/* Empty prompt */
.empty-prompt { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px; text-align: center; }
.empty-prompt__icon { font-size: 48px; opacity: 0.5; }
.empty-prompt__text { font-size: 15px; color: var(--text-secondary); line-height: 1.6; max-width: 280px; }

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 10px; }

/* Utility */
.text-right    { text-align: right; }
.text-center   { text-align: center; }
.text-bold     { font-weight: 700; }
.text-blue     { color: var(--blue); }
.text-secondary{ color: var(--text-secondary); }
.text-sm       { font-size: 12px; }
.font-bold     { font-weight: 700; }
.font-mono     { font-family: monospace; }

/* Fields */
.field        { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__input, .field__select {
  padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px;
  font-size: 15px; min-height: 48px; width: 100%; box-sizing: border-box;
  background: var(--bg); color: var(--text-primary);
}

@media print {
  .no-print { display: none !important; }
  .history-page { padding: 0 !important; }
  .report-body  { box-shadow: none !important; border-radius: 0 !important; }
  .report-table { font-size: 11px; }
  .signatures   { page-break-inside: avoid; }
}
</style>
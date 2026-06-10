<template>
  <div class="energy-home">

    <!-- ── Search bar ── -->
    <div class="search-bar-wrap">
      <button class="search-bar" @click="searchStore.openSearch()">
        <span class="search-bar__icon">🔍</span>
        <span class="search-bar__placeholder">Search meters or areas…</span>
      </button>
    </div>

    <!-- ── Period toggle ── -->
    <div class="period-toggle" role="tablist">
      <button
        v-for="type in periodTypes"
        :key="type.value"
        class="period-btn"
        :class="{ 'period-btn--active': activePeriod === type.value }"
        @click="activePeriod = type.value; loadCurrentEntries()"
      >
        {{ type.label }}
      </button>
    </div>

    <!-- ── Loading ── -->
    <div v-if="store.loading.sessions" class="skeleton-list">
      <div class="skeleton" style="height: 130px" />
      <div class="skeleton" style="height: 100px" />
      <div class="skeleton" style="height: 240px" />
    </div>

    <template v-else>

      <!-- ── Current period summary ── -->
      <div class="summary-card card">
        <p class="summary-card__period-label">{{ activePeriod }}</p>
        <p class="summary-card__dates">{{ currentPeriodLabel }}</p>
        <p class="summary-card__kwh">
          {{ currentSession ? formatKwh(currentSession.total_kwh) : '—' }}
        </p>
        <p class="summary-card__unit">kWh total campus consumption</p>

        <div v-if="comparison" class="comparison-row">
          <span
            class="comparison-row__change"
            :class="comparison.direction === 'up' ? 'change--up' : 'change--down'"
          >
            {{ comparison.direction === 'up' ? '▲' : '▼' }} {{ comparison.percentChange }}%
          </span>
          <span class="comparison-row__label">
            {{ comparison.direction === 'up' ? 'higher' : 'lower' }} than previous period
          </span>
        </div>
        <p v-else class="summary-card__no-compare">No previous period to compare yet.</p>
      </div>

      <!-- ── Working vs Non-Working ── -->
      <div v-if="wvnw" class="wvnw-card card">
        <p class="card-title">Working vs. Non-Working Days</p>
        <div class="wvnw-grid">
          <div class="wvnw-col">
            <span class="wvnw-col__label">Working Days</span>
            <span class="wvnw-col__kwh">{{ formatKwh(wvnw.workingKwh) }}</span>
            <span class="wvnw-col__meta">{{ wvnw.workingDays }} days · {{ wvnw.workingDaily }} kWh/day</span>
          </div>
          <div class="wvnw-divider" />
          <div class="wvnw-col">
            <span class="wvnw-col__label">Non-Working Days</span>
            <span class="wvnw-col__kwh">{{ formatKwh(wvnw.nonWorkingKwh) }}</span>
            <span class="wvnw-col__meta">{{ wvnw.nonWorkingDays }} days · {{ wvnw.nonWorkingDaily }} kWh/day</span>
          </div>
        </div>
        <p class="wvnw-insight">💡 {{ wvnw.insight }}</p>
      </div>

      <!-- ── Meter list ── -->
      <div class="meter-block">
        <p class="section-label">METERS — HIGHEST CONSUMPTION FIRST</p>

        <div v-if="!sortedMeterRows.length" class="empty-note">
          No readings recorded for this period yet.
          <RouterLink to="/energy/enter-readings" class="empty-link">Enter readings →</RouterLink>
        </div>

        <div v-else class="meter-list">
          <div
            v-for="row in sortedMeterRows"
            :key="row.meter_id"
            class="meter-row"
            :class="{ 'meter-row--warning': row.isZeroWarning }"
          >
            <div class="meter-row__left">
              <span class="meter-row__area">{{ row.area_name }}</span>
              <span class="meter-row__num">Meter {{ row.meter_number }}</span>
            </div>
            <span v-if="row.isZeroWarning" class="zero-warning">0 kWh — check meter</span>
            <span v-else class="meter-row__kwh">{{ formatKwh(row.actual_kwh) }} kWh</span>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useEnergyStore } from '@/stores/energy'
import { useSearchStore } from '@/stores/search'

const store       = useEnergyStore()
const searchStore = useSearchStore()

const periodTypes = [
  { value: 'Monthly',          label: 'Monthly' },
  { value: 'Working Days',     label: 'Working Days' },
  { value: 'Non-Working Days', label: 'Non-Working Days' },
]

const activePeriod    = ref('Monthly')
const latestEntries   = ref([])

// ── Current session for active period ────────────────────────────────────
const currentSession = computed(() => {
  const map = {
    'Monthly':          store.latestMonthly?.[0],
    'Working Days':     store.latestWorkingDays?.[0],
    'Non-Working Days': store.latestNonWorkingDays?.[0],
  }
  return map[activePeriod.value] ?? null
})

const currentPeriodLabel = computed(() => {
  const s = currentSession.value
  if (!s) return 'No data yet for this period'
  return `${formatDate(s.date_from)} – ${formatDate(s.date_to)}`
})

const comparison = computed(() => store.getPeriodComparison(activePeriod.value))
const wvnw       = computed(() => store.getWorkingVsNonWorking())

// ── Meter rows sorted by highest consumption ──────────────────────────────
const sortedMeterRows = computed(() =>
  latestEntries.value
    .map((e) => ({
      meter_id:     e.meter_id,
      meter_number: e.meter?.meter_number,
      area_name:    e.meter?.area_name ?? '—',
      actual_kwh:   parseFloat(e.actual_kwh) || 0,
      isZeroWarning: parseFloat(e.actual_kwh) === 0 && parseFloat(e.previous_reading) > 0,
    }))
    .sort((a, b) => b.actual_kwh - a.actual_kwh)
)

async function loadCurrentEntries() {
  const s = currentSession.value
  if (!s) { latestEntries.value = []; return }
  const result = await store.fetchEntriesBySessionRaw(s.session_id)
  latestEntries.value = result.data ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatKwh(val) {
  return (parseFloat(val) || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

onMounted(async () => {
  await Promise.all([store.fetchMeters(), store.fetchLatestSessions()])
  await loadCurrentEntries()
})
</script>

<style scoped>
.energy-home {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Search bar */
.search-bar-wrap { width: 100%; }
.search-bar {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 13px 16px;
  background: var(--surface); border: 2px solid var(--border);
  border-radius: 12px; cursor: pointer; text-align: left;
  min-height: 52px; box-shadow: var(--shadow-sm); transition: border-color 0.15s;
}
.search-bar:hover { border-color: var(--blue); }
.search-bar__icon        { font-size: 18px; opacity: 0.5; flex-shrink: 0; }
.search-bar__placeholder { font-size: 15px; color: var(--text-disabled); }

/* Period toggle */
.period-toggle { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.period-toggle::-webkit-scrollbar { display: none; }
.period-btn {
  flex-shrink: 0; padding: 10px 18px;
  border: 2px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text-secondary);
  font-size: 14px; font-weight: 600; cursor: pointer;
  min-height: 48px; white-space: nowrap; transition: all 0.15s;
}
.period-btn--active { border-color: var(--blue); background: var(--blue); color: #fff; }

/* Summary card */
.summary-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 28px 20px; text-align: center;
}
.summary-card__period-label {
  font-size: 12px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--blue); margin: 0;
}
.summary-card__dates { font-size: 13px; color: var(--text-secondary); margin: 0; }
.summary-card__kwh   { font-size: 52px; font-weight: 900; color: var(--text-primary); line-height: 1; margin: 8px 0 0; }
.summary-card__unit  { font-size: 14px; color: var(--text-secondary); margin: 0; }
.summary-card__no-compare { font-size: 13px; color: var(--text-secondary); margin: 0; }

.comparison-row { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
.comparison-row__change { font-size: 15px; font-weight: 800; }
.comparison-row__label  { color: var(--text-secondary); }
.change--up   { color: var(--red); }
.change--down { color: var(--green); }

/* Working vs Non-Working */
.wvnw-card { display: flex; flex-direction: column; gap: 14px; padding: 18px; }
.card-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.wvnw-grid  { display: flex; align-items: stretch; }
.wvnw-col   { flex: 1; display: flex; flex-direction: column; gap: 4px; padding: 4px 10px; }
.wvnw-col:first-child { padding-left: 0; }
.wvnw-col:last-child  { padding-right: 0; }
.wvnw-col__label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); }
.wvnw-col__kwh   { font-size: 20px; font-weight: 900; color: var(--text-primary); }
.wvnw-col__meta  { font-size: 12px; color: var(--text-secondary); }
.wvnw-divider    { width: 1px; background: var(--border); margin: 0 4px; }
.wvnw-insight    { font-size: 13px; color: var(--text-secondary); line-height: 1.6; background: var(--bg); border-radius: 8px; padding: 10px 12px; margin: 0; }

/* Meter block */
.meter-block { display: flex; flex-direction: column; gap: 10px; }
.section-label { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; color: var(--text-secondary); }

.meter-list { background: var(--surface); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-sm); }

.meter-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-bottom: 1px solid var(--divider); gap: 12px;
}
.meter-row:last-child { border-bottom: none; }
.meter-row--warning   { background: #fffdf0; }

.meter-row__left { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.meter-row__area { font-size: 15px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meter-row__num  { font-size: 12px; color: var(--text-secondary); }
.meter-row__kwh  { font-size: 16px; font-weight: 800; color: var(--text-primary); flex-shrink: 0; }

.zero-warning {
  font-size: 12px; font-weight: 700; color: var(--yellow);
  background: #fff; padding: 3px 10px; border-radius: 20px;
  border: 1.5px solid var(--yellow); flex-shrink: 0;
}

.empty-note { font-size: 14px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }
.empty-link { color: var(--blue); font-weight: 600; }
.skeleton-list { display: flex; flex-direction: column; gap: 12px; }
</style>
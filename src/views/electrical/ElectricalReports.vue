<template>
  <div class="reports-page">

    <!-- Header -->
    <header class="reports-header">
      <h1 class="reports-header__title">Reports</h1>
      <p class="reports-header__subtitle">Monthly summary of repair requests</p>
    </header>

    <!-- ── Filters ── -->
    <section class="filters card">
      <div class="field">
        <label class="field__label">Month</label>
        <select v-model="selectedMonth" class="field__select">
          <option v-for="m in monthOptions" :key="m.value" :value="m.value">
            {{ m.label }}
          </option>
        </select>
      </div>

      <div class="field">
        <label class="field__label">Building</label>
        <select v-model="selectedBuildingId" class="field__select">
          <option value="all">All Buildings</option>
          <option
            v-for="b in store.buildings"
            :key="b.building_id"
            :value="b.building_id"
          >
            {{ b.building_name }}
          </option>
        </select>
      </div>

      <button class="btn-primary generate-btn" @click="generateReport" :disabled="loading">
        {{ loading ? 'Loading…' : 'Generate Report' }}
      </button>
    </section>

    <!-- ── Loading ── -->
    <div v-if="loading" class="skeleton-list">
      <div class="skeleton" style="height: 100px" />
      <div class="skeleton" style="height: 200px" />
      <div class="skeleton" style="height: 300px" />
    </div>

    <!-- ── Error ── -->
    <div v-else-if="fetchError" class="error-banner">
      {{ fetchError }}
    </div>

    <!-- ── Report Content ── -->
    <template v-else-if="reportGenerated">

      <!-- Print button -->
      <div class="print-bar no-print">
        <span class="print-bar__hint">This report is ready to print and sign.</span>
        <button class="btn-ghost print-btn" @click="printReport">
          🖨 Print Report
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════
           PRINTABLE REPORT AREA — everything inside .report-body prints
      ══════════════════════════════════════════════════════════════════ -->
      <div class="report-body" id="report-print-area">

        <!-- Report letterhead -->
        <div class="report-letterhead">
          <p class="report-letterhead__org">Caraga State University</p>
          <p class="report-letterhead__dept">General Services Office — Electrical Section</p>
          <h2 class="report-letterhead__title">Monthly Repair Request Report</h2>
          <p class="report-letterhead__period">
            {{ reportTitle }}
            <span v-if="selectedBuildingId !== 'all'">
              · {{ buildingName }}
            </span>
          </p>
        </div>

        <!-- ── Summary totals ── -->
        <section class="report-section">
          <h3 class="report-section__title">Summary</h3>
          <div class="summary-grid">
            <div class="summary-tile">
              <span class="summary-tile__number">{{ summary.received }}</span>
              <span class="summary-tile__label">Requests received</span>
            </div>
            <div class="summary-tile summary-tile--green">
              <span class="summary-tile__number">{{ summary.resolved }}</span>
              <span class="summary-tile__label">Resolved (fixed)</span>
            </div>
            <div class="summary-tile" :class="summary.stillOpen > 0 ? 'summary-tile--red' : 'summary-tile--green'">
              <span class="summary-tile__number">{{ summary.stillOpen }}</span>
              <span class="summary-tile__label">Still not fixed</span>
            </div>
          </div>
        </section>

        <!-- ── Per-building breakdown ── -->
        <section class="report-section" v-if="buildingBreakdowns.length">
          <h3 class="report-section__title">Breakdown by Building</h3>

          <div
            v-for="breakdown in buildingBreakdowns"
            :key="breakdown.building_id"
            class="building-breakdown"
          >
            <h4 class="building-breakdown__name">{{ breakdown.building_name }}</h4>

            <!-- Busted items by type -->
            <div v-if="breakdown.bustedByType.length" class="breakdown-table-wrap">
              <table class="breakdown-table">
                <thead>
                  <tr>
                    <th>Item Type</th>
                    <th>Category</th>
                    <th class="text-right">Busted Units</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in breakdown.bustedByType"
                    :key="row.item_type"
                  >
                    <td>{{ row.item_type }}</td>
                    <td class="text-secondary">{{ row.category }}</td>
                    <td class="text-right text-red font-bold">{{ row.busted }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" class="font-bold">Total busted units</td>
                    <td class="text-right text-red font-bold">{{ breakdown.totalBusted }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p v-else class="no-data-note">No busted items recorded for this building this month.</p>

            <!-- Request counts for this building -->
            <div class="building-request-counts">
              <span>Requests this month: <strong>{{ breakdown.received }}</strong></span>
              <span>Fixed: <strong class="text-green">{{ breakdown.resolved }}</strong></span>
              <span v-if="breakdown.stillOpen > 0">
                Still open: <strong class="text-red">{{ breakdown.stillOpen }}</strong>
              </span>
            </div>
          </div>
        </section>

        <!-- ── Full audit trail ── -->
        <section class="report-section">
          <h3 class="report-section__title">All Requests This Month</h3>

          <div v-if="!allRequestsThisMonth.length" class="no-data-note">
            No repair requests were recorded for this period.
          </div>

          <table v-else class="audit-table">
            <thead>
              <tr>
                <th>Date Reported</th>
                <th>Building / Room</th>
                <th>Item</th>
                <th>Problem</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Date Fixed</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="req in allRequestsThisMonth"
                :key="req.request_id"
                :class="{ 'row--resolved': req.status === 'Resolved' }"
              >
                <td class="text-nowrap">{{ formatDate(req.date_reported) }}</td>
                <td>
                  <span class="text-bold">{{ req.building_name }}</span><br />
                  <span class="text-secondary text-sm">{{ req.room_label }}</span>
                </td>
                <td>{{ req.equipment_item?.item_type ?? '—' }}</td>
                <td>{{ req.problem_description }}</td>
                <td class="text-center">{{ req.quantity_affected }}</td>
                <td>
                  <span class="badge" :class="req.status === 'Resolved' ? 'badge--green' : 'badge--yellow'">
                    {{ req.status === 'Resolved' ? 'Fixed' : 'Pending' }}
                  </span>
                </td>
                <td class="text-nowrap">{{ req.date_resolved ? formatDate(req.date_resolved) : '—' }}</td>
                <td class="text-secondary text-sm">{{ req.action_taken ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── Signature lines ── -->
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

        <!-- Report footer -->
        <p class="report-footer">
          Generated on {{ formatDate(new Date().toISOString().split('T')[0]) }}
          · FaciliTrack GSO
        </p>

      </div>
      <!-- end .report-body -->

    </template>

    <!-- ── Initial empty state ── -->
    <div v-else class="empty-prompt">
      <span class="empty-prompt__icon">📋</span>
      <p class="empty-prompt__text">
        Select a month and building above, then tap <strong>Generate Report</strong>.
      </p>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useElectricalStore } from '@/stores/electrical'
import { supabase } from '@/lib/supabase'

const store = useElectricalStore()

// ── Filter state ────────────────────────────────────────────────────────────
const today          = new Date()
const selectedMonth  = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)
const selectedBuildingId = ref('all')

// ── Report state ────────────────────────────────────────────────────────────
const loading         = ref(false)
const fetchError      = ref(null)
const reportGenerated = ref(false)
const rawRequests     = ref([])   // all repair_request rows for the selected period
//comment for now
// const rawRooms        = ref([])   // room rows with their building name

// ── Month options (last 24 months) ──────────────────────────────────────────
const monthOptions = computed(() => {
  const options = []
  const d = new Date()
  for (let i = 0; i < 24; i++) {
    const year  = d.getFullYear()
    const month = d.getMonth() + 1
    const value = `${year}-${String(month).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    options.push({ value, label })
    d.setMonth(d.getMonth() - 1)
  }
  return options
})

// ── Derived: report title ────────────────────────────────────────────────────
const reportTitle = computed(() => {
  const found = monthOptions.value.find((m) => m.value === selectedMonth.value)
  return found ? found.label : selectedMonth.value
})

const buildingName = computed(() => {
  if (selectedBuildingId.value === 'all') return 'All Buildings'
  const b = store.buildings.find((b) => b.building_id === Number(selectedBuildingId.value))
  return b?.building_name ?? '—'
})

// ── Date range from selected month ──────────────────────────────────────────
function getDateRange(monthStr) {
  const [year, month] = monthStr.split('-').map(Number)
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

// ── Generate report: fetch from Supabase ────────────────────────────────────
async function generateReport() {
  loading.value    = true
  fetchError.value = null
  reportGenerated.value = false

  try {
    const { from, to } = getDateRange(selectedMonth.value)

    // Build the query
    let query = supabase
      .from('repair_request')
      .select(`
        request_id,
        room_id,
        item_id,
        problem_description,
        quantity_affected,
        date_reported,
        date_resolved,
        action_taken,
        status,
        notes,
        equipment_item (
          item_id,
          item_type,
          category,
          busted_count
        ),
        room:room_id (
          room_id,
          room_number,
          room_name,
          floor_level,
          building_id,
          building:building_id (
            building_id,
            building_name
          )
        )
      `)
      .gte('date_reported', from)
      .lte('date_reported', to)
      .order('date_reported', { ascending: true })

    // Filter by building if one is selected
    if (selectedBuildingId.value !== 'all') {
      // We need to filter by building through the room relationship
      // Supabase doesn't support nested filters directly, so we get all
      // and filter client-side
    }

    const { data, error: sbError } = await query
    if (sbError) throw sbError

    let results = data ?? []

    // Client-side building filter
    if (selectedBuildingId.value !== 'all') {
      const bid = Number(selectedBuildingId.value)
      results = results.filter((r) => r.room?.building_id === bid)
    }

    rawRequests.value = results
    reportGenerated.value = true
  } catch (err) {
    fetchError.value = `Could not load report data. ${err.message ?? 'Please try again.'}`
    console.error('[ElectricalReports] generateReport:', err)
  } finally {
    loading.value = false
  }
}

// ── Derived: summary totals ──────────────────────────────────────────────────
const summary = computed(() => {
  const received = rawRequests.value.length
  const resolved = rawRequests.value.filter((r) => r.status === 'Resolved').length
  return {
    received,
    resolved,
    stillOpen: received - resolved,
  }
})

// ── Derived: flat list with building/room labels ─────────────────────────────
const allRequestsThisMonth = computed(() =>
  rawRequests.value.map((req) => ({
    ...req,
    building_name: req.room?.building?.building_name ?? '—',
    room_label:    `${req.room?.room_number ?? ''} ${req.room?.room_name ?? ''}`.trim(),
  }))
)

// ── Derived: per-building breakdown ─────────────────────────────────────────
const buildingBreakdowns = computed(() => {
  // Group requests by building
  const grouped = {}

  for (const req of allRequestsThisMonth.value) {
    const bid  = req.room?.building_id
    const name = req.room?.building?.building_name ?? 'Unknown Building'
    if (!bid) continue

    if (!grouped[bid]) {
      grouped[bid] = {
        building_id:   bid,
        building_name: name,
        requests:      [],
      }
    }
    grouped[bid].requests.push(req)
  }

  // For each building, compute busted-by-type and request counts
  return Object.values(grouped).map((group) => {
    const received = group.requests.length
    const resolved = group.requests.filter((r) => r.status === 'Resolved').length
    const stillOpen = received - resolved

    // Aggregate busted counts by item_type from the open requests
    const typeMap = {}
    for (const req of group.requests) {
      if (req.status !== 'Resolved' && req.equipment_item) {
        const key = req.equipment_item.item_type
        if (!typeMap[key]) {
          typeMap[key] = {
            item_type: key,
            category:  req.equipment_item.category,
            busted:    0,
          }
        }
        typeMap[key].busted += req.quantity_affected ?? 1
      }
    }

    const bustedByType = Object.values(typeMap).sort((a, b) =>
      b.busted - a.busted
    )
    const totalBusted = bustedByType.reduce((s, t) => s + t.busted, 0)

    return {
      building_id:   group.building_id,
      building_name: group.building_name,
      bustedByType,
      totalBusted,
      received,
      resolved,
      stillOpen,
    }
  }).sort((a, b) => a.building_name.localeCompare(b.building_name))
})

// ── Print ─────────────────────────────────────────────────────────────────────
function printReport() {
  window.print()
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!store.buildings.length) await store.fetchBuildings()
})
</script>

<style scoped>
.reports-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Header ── */
.reports-header__title    { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.reports-header__subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 2px; }

/* ── Filters ── */
.filters {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.generate-btn {
  width: 100%;
  margin-top: 4px;
}

/* ── Print bar ── */
.print-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.print-bar__hint { font-size: 14px; color: var(--text-secondary); }
.print-btn {
  flex-shrink: 0;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 700;
}

/* ── Report body ── */
.report-body {
  background: var(--surface);
  border-radius: 14px;
  padding: 28px 24px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── Letterhead ── */
.report-letterhead { text-align: center; border-bottom: 2px solid var(--border); padding-bottom: 20px; }
.report-letterhead__org   { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.report-letterhead__dept  { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.report-letterhead__title { font-size: 20px; font-weight: 800; color: var(--text-primary); margin-top: 10px; }
.report-letterhead__period { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }

/* ── Report sections ── */
.report-section { display: flex; flex-direction: column; gap: 14px; }
.report-section__title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding-bottom: 8px;
  border-bottom: 1.5px solid var(--border);
}

/* ── Summary tiles ── */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.summary-tile {
  background: var(--bg);
  border-radius: 12px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  border: 2px solid var(--border);
}
.summary-tile--green { border-color: var(--green-light); background: var(--green-light); }
.summary-tile--red   { border-color: var(--red-light);   background: var(--red-light); }

.summary-tile__number {
  font-size: 32px;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1;
}
.summary-tile--green .summary-tile__number { color: var(--green); }
.summary-tile--red   .summary-tile__number { color: var(--red); }

.summary-tile__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* ── Building breakdown ── */
.building-breakdown {
  background: var(--bg);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1.5px solid var(--border);
}

.building-breakdown__name {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
}

.breakdown-table-wrap { overflow-x: auto; }

.breakdown-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.breakdown-table th {
  text-align: left;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border);
}
.breakdown-table td {
  padding: 10px 10px;
  border-bottom: 1px solid var(--divider);
  vertical-align: middle;
  color: var(--text-primary);
}
.breakdown-table tfoot td {
  border-top: 2px solid var(--border);
  border-bottom: none;
  padding-top: 12px;
}

.building-request-counts {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 14px;
  color: var(--text-secondary);
}

/* ── Audit trail table ── */
.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.audit-table th {
  text-align: left;
  padding: 9px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--border);
  white-space: nowrap;
}
.audit-table td {
  padding: 10px 10px;
  border-bottom: 1px solid var(--divider);
  vertical-align: top;
  color: var(--text-primary);
}
.audit-table .row--resolved td { color: var(--text-secondary); }

/* ── Signatures ── */
.signatures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  padding-top: 16px;
  border-top: 1.5px solid var(--border);
}
.signature-block { display: flex; flex-direction: column; gap: 6px; }
.signature-block__line {
  height: 1px;
  background: var(--text-primary);
  margin-bottom: 8px;
  margin-top: 40px;   /* space for actual signature */
}
.signature-block__name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.signature-block__role { font-size: 13px; color: var(--text-secondary); }
.signature-block__label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

/* ── Report footer ── */
.report-footer { font-size: 12px; color: var(--text-secondary); text-align: center; }

/* ── Empty prompt ── */
.empty-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;
  color: var(--text-secondary);
}
.empty-prompt__icon { font-size: 48px; opacity: 0.5; }
.empty-prompt__text { font-size: 15px; line-height: 1.6; max-width: 280px; }

/* ── Skeleton ── */
.skeleton-list { display: flex; flex-direction: column; gap: 12px; }

/* ── No data note ── */
.no-data-note { font-size: 14px; color: var(--text-secondary); font-style: italic; }

/* ── Utility ── */
.text-right    { text-align: right; }
.text-center   { text-align: center; }
.text-red      { color: var(--red); }
.text-green    { color: var(--green); }
.text-bold     { font-weight: 700; }
.text-secondary { color: var(--text-secondary); }
.text-sm       { font-size: 12px; }
.text-nowrap   { white-space: nowrap; }
.font-bold     { font-weight: 700; }

/* ════════════════════════════════════════════════════════════════════════════
   PRINT STYLES
   When window.print() is called, hide everything except .report-body
════════════════════════════════════════════════════════════════════════════ */
@media print {
  /* Hide the shell navigation and filter area */
  .no-print { display: none !important; }

  /* Reset page padding for print */
  .reports-page {
    padding: 0 !important;
    gap: 0 !important;
    max-width: 100% !important;
  }

  /* Filters, print bar, empty prompt — all hidden when printing */
  .filters,
  .print-bar,
  .empty-prompt,
  .skeleton-list {
    display: none !important;
  }

  /* Report body fills the printed page */
  .report-body {
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 20px !important;
  }

  /* Avoid page breaks inside rows */
  .audit-table tr { page-break-inside: avoid; }
  .building-breakdown { page-break-inside: avoid; }
  .signatures { page-break-inside: avoid; }

  /* Make tables full width on paper */
  .breakdown-table,
  .audit-table { font-size: 11px; }

  .summary-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
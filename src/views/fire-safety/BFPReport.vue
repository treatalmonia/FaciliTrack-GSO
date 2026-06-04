<template>
  <div class="bfp-report-page">

    <header class="report-page-header">
      <h1 class="report-page-header__title">BFP Inspection Report</h1>
      <p class="report-page-header__subtitle">
        Generated on demand — print and bring to the BFP inspector.
      </p>
    </header>

    <!-- Generate button -->
    <div class="generate-bar no-print">
      <button
        class="btn-primary generate-btn"
        :disabled="store.loading.compliances || store.loading.units"
        @click="generateReport"
      >
        {{ (store.loading.compliances || store.loading.units) ? 'Loading…' : 'Generate Report' }}
      </button>
      <button v-if="reportReady" class="btn-ghost print-btn" @click="window.print()">
        🖨 Print Report
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading.compliances" class="skeleton-list">
      <div v-for="n in 3" :key="n" class="skeleton" style="height: 160px" />
    </div>

    <!-- Report content -->
    <div v-else-if="reportReady" id="bfp-print-area" class="report-body">

      <!-- Letterhead -->
      <div class="report-letterhead">
        <p class="report-letterhead__org">Caraga State University</p>
        <p class="report-letterhead__dept">General Services Office</p>
        <h2 class="report-letterhead__title">BFP Inspection Readiness Summary</h2>
        <p class="report-letterhead__date">Generated: {{ formatDate(todayStr) }}</p>
      </div>

      <!-- Campus summary -->
      <section class="report-section">
        <h3 class="report-section__title">Campus Overview</h3>
        <div class="campus-summary-grid">
          <div class="summary-tile summary-tile--green">
            <span class="summary-tile__number">{{ readyCount }}</span>
            <span class="summary-tile__label">Buildings Ready</span>
          </div>
          <div class="summary-tile" :class="notReadyCount > 0 ? 'summary-tile--red' : 'summary-tile--green'">
            <span class="summary-tile__number">{{ notReadyCount }}</span>
            <span class="summary-tile__label">Buildings Not Ready</span>
          </div>
          <div class="summary-tile">
            <span class="summary-tile__number">{{ store.campusTotals.feOnSite }}</span>
            <span class="summary-tile__label">Fire Extinguishers on Campus</span>
          </div>
          <div class="summary-tile" :class="feGap > 0 ? 'summary-tile--red' : 'summary-tile--green'">
            <span class="summary-tile__number">{{ feGap }}</span>
            <span class="summary-tile__label">More Extinguishers Needed</span>
          </div>
        </div>
      </section>

      <!-- Per-building sections -->
      <section
        v-for="item in buildingReports"
        :key="item.building.building_id"
        class="building-report"
      >
        <div class="building-report__header">
          <h3 class="building-report__name">{{ item.building.building_name }}</h3>
          <span
            class="readiness-badge"
            :class="item.compliance?.bfp_ready ? 'readiness-badge--ready' : 'readiness-badge--not'"
          >
            {{ item.compliance?.bfp_ready ? '✓ READY' : '✗ NOT READY' }}
          </span>
        </div>

        <!-- FE counts by floor -->
        <div v-if="item.floors.length" class="building-report__section">
          <p class="building-report__section-label">Fire Extinguishers by Floor</p>
          <table class="fe-table">
            <thead>
              <tr>
                <th>Floor</th>
                <th>10 lbs On Site</th>
                <th>10 lbs Needed</th>
                <th>5 lbs On Site</th>
                <th>5 lbs Needed</th>
                <th>HCFC On Site</th>
                <th>HCFC Needed</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="floor in item.floors" :key="floor.id">
                <td>{{ floor.floor_level }}</td>
                <td class="text-center">{{ floor.fe_10lbs_on_site ?? 0 }}</td>
                <td class="text-center">{{ floor.fe_10lbs_needed ?? 0 }}</td>
                <td class="text-center">{{ floor.fe_5lbs_on_site ?? 0 }}</td>
                <td class="text-center">{{ floor.fe_5lbs_needed ?? 0 }}</td>
                <td class="text-center">{{ floor.fe_hcfc_on_site ?? 0 }}</td>
                <td class="text-center">{{ floor.fe_hcfc_needed ?? 0 }}</td>
                <td class="text-center" :class="floorGap(floor) > 0 ? 'text-red' : 'text-green'">
                  {{ floorGap(floor) > 0 ? floorGap(floor) : '✓' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Emergency lights -->
        <div v-if="item.compliance" class="building-report__section">
          <p class="building-report__section-label">Emergency Lights</p>
          <div class="el-summary">
            <span>On site: <strong>{{ item.compliance.emergency_lights_on_site ?? 0 }}</strong></span>
            <span>Needed: <strong>{{ item.compliance.emergency_lights_needed ?? 0 }}</strong></span>
            <span :class="elGap(item.compliance) > 0 ? 'text-red' : 'text-green'">
              Gap: <strong>{{ elGap(item.compliance) > 0 ? elGap(item.compliance) : '✓ Sufficient' }}</strong>
            </span>
          </div>
          <p v-if="item.compliance.emergency_lights_notes" class="el-note">
            Note: {{ item.compliance.emergency_lights_notes }}
          </p>
        </div>

        <!-- Binary compliance features -->
        <div v-if="item.compliance" class="building-report__section">
          <p class="building-report__section-label">Safety Requirements</p>
          <div class="features-grid">
            <div
              v-for="feat in binaryFeaturesList"
              :key="feat.field"
              class="feature-item"
              :class="item.compliance[feat.field] ? 'feature-item--yes' : 'feature-item--no'"
            >
              <span>{{ item.compliance[feat.field] ? '✓' : '✗' }}</span>
              <span>{{ feat.label }}</span>
            </div>
            <div class="feature-item feature-item--count">
              <span>{{ item.compliance.evacuation_plan_count ?? 0 }}</span>
              <span>Evacuation Plan Boards</span>
            </div>
            <div class="feature-item feature-item--count">
              <span>{{ item.compliance.led_exit_count ?? 0 }}</span>
              <span>LED EXIT Signs</span>
            </div>
          </div>
        </div>

        <!-- Remarks -->
        <p v-if="item.compliance?.remarks" class="building-report__remarks">
          Remarks: {{ item.compliance.remarks }}
        </p>
      </section>

      <!-- Procurement estimate -->
      <section class="report-section procurement-section">
        <h3 class="report-section__title">Procurement Estimate</h3>
        <p class="procurement-note">
          Based on current gaps across all buildings. Unit prices are standard GSO procurement rates.
        </p>
        <table class="procurement-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Units Needed</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Estimated Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Fire Extinguisher — 10 lbs</td>
              <td class="text-right">{{ procurement.fe10lbs }}</td>
              <td class="text-right">₱2,500.00</td>
              <td class="text-right">{{ formatPeso(procurement.fe10lbs * 2500) }}</td>
            </tr>
            <tr>
              <td>Fire Extinguisher — 5 lbs</td>
              <td class="text-right">{{ procurement.fe5lbs }}</td>
              <td class="text-right">₱2,000.00</td>
              <td class="text-right">{{ formatPeso(procurement.fe5lbs * 2000) }}</td>
            </tr>
            <tr>
              <td>Emergency Light</td>
              <td class="text-right">{{ procurement.el }}</td>
              <td class="text-right">₱2,000.00</td>
              <td class="text-right">{{ formatPeso(procurement.el * 2000) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="font-bold">Grand Total Estimated Cost</td>
              <td class="text-right font-bold text-blue">{{ formatPeso(procurement.grandTotal) }}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <!-- Signatures -->
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
        Generated {{ formatDate(todayStr) }} · FaciliTrack GSO · Fire Safety Module
      </p>

    </div>

    <!-- Initial prompt -->
    <div v-else class="empty-prompt">
      <span class="empty-prompt__icon">🧯</span>
      <p class="empty-prompt__text">
        Tap <strong>Generate Report</strong> to create the BFP Inspection Readiness Summary.
      </p>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFireSafetyStore } from '@/stores/firesafety'

const store    = useFireSafetyStore()
const todayStr = new Date().toISOString().split('T')[0]
const reportReady = ref(false)

const binaryFeaturesList = [
  { field: 'fire_hose_cabinet', label: 'Fire Hose Cabinet' },
  { field: 'exit_right',        label: 'EXIT RIGHT sign' },
  { field: 'exit_left',         label: 'EXIT LEFT sign' },
  { field: 'exit_sign',         label: 'EXIT sign (general)' },
  { field: 'sprinkler_system',  label: 'Sprinkler System' },
  { field: 'smoke_detector',    label: 'Smoke Detector' },
]

async function generateReport() {
  await Promise.all([
    store.fetchBuildings(),
    store.fetchCompliances(),
  ])
  reportReady.value = true
}

// ── Derived data ───────────────────────────────────────────────────────────
const readyCount    = computed(() => store.compliances.filter((c) => c.bfp_ready).length)
const notReadyCount = computed(() => store.compliances.filter((c) => !c.bfp_ready).length)
const feGap         = computed(() =>
  Math.max(0, store.campusTotals.feNeeded - store.campusTotals.feOnSite)
)

const buildingReports = computed(() =>
  store.buildings.map((b) => ({
    building:   b,
    compliance: store.compliances.find((c) => c.building_id === b.building_id) ?? null,
    floors:     store.floorFE.filter((f) => f.building_id === b.building_id),
  }))
)

const procurement = computed(() => {
  let fe10lbs = 0, fe5lbs = 0, el = 0

  for (const floor of store.floorFE) {
    fe10lbs += Math.max(0, (floor.fe_10lbs_needed ?? 0) - (floor.fe_10lbs_on_site ?? 0))
    fe5lbs  += Math.max(0, (floor.fe_5lbs_needed  ?? 0) - (floor.fe_5lbs_on_site  ?? 0))
  }
  for (const c of store.compliances) {
    el += Math.max(0, (c.emergency_lights_needed ?? 0) - (c.emergency_lights_on_site ?? 0))
  }

  return {
    fe10lbs,
    fe5lbs,
    el,
    grandTotal: (fe10lbs * 2500) + (fe5lbs * 2000) + (el * 2000),
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────
function floorGap(floor) {
  return (
    Math.max(0, (floor.fe_10lbs_needed ?? 0) - (floor.fe_10lbs_on_site ?? 0)) +
    Math.max(0, (floor.fe_5lbs_needed  ?? 0) - (floor.fe_5lbs_on_site  ?? 0)) +
    Math.max(0, (floor.fe_hcfc_needed  ?? 0) - (floor.fe_hcfc_on_site  ?? 0))
  )
}

function elGap(compliance) {
  return Math.max(0, (compliance.emergency_lights_needed ?? 0) - (compliance.emergency_lights_on_site ?? 0))
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatPeso(amount) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

onMounted(async () => {
  if (!store.buildings.length) await store.fetchBuildings()
})
</script>

<style scoped>
.bfp-report-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.report-page-header__title    { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.report-page-header__subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 2px; }

.generate-bar { display: flex; gap: 12px; flex-wrap: wrap; }
.generate-btn { flex: 1; min-width: 180px; }
.print-btn    { flex-shrink: 0; padding: 12px 20px; font-size: 14px; }

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
.report-letterhead__org   { font-size: 15px; font-weight: 700; }
.report-letterhead__dept  { font-size: 13px; color: var(--text-secondary); }
.report-letterhead__title { font-size: 20px; font-weight: 800; margin-top: 10px; }
.report-letterhead__date  { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

/* Sections */
.report-section { display: flex; flex-direction: column; gap: 14px; }
.report-section__title {
  font-size: 14px; font-weight: 800; color: var(--text-primary);
  text-transform: uppercase; letter-spacing: 0.07em;
  padding-bottom: 8px; border-bottom: 1.5px solid var(--border);
}

/* Campus summary */
.campus-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.summary-tile {
  background: var(--bg);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 2px solid var(--border);
  text-align: center;
}
.summary-tile--green { border-color: var(--green-light); background: var(--green-light); }
.summary-tile--red   { border-color: var(--red-light);   background: var(--red-light); }
.summary-tile__number { font-size: 28px; font-weight: 900; }
.summary-tile--green .summary-tile__number { color: var(--green); }
.summary-tile--red   .summary-tile__number { color: var(--red); }
.summary-tile__label  { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

/* Per-building report */
.building-report {
  background: var(--bg);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border: 1.5px solid var(--border);
  page-break-inside: avoid;
}

.building-report__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.building-report__name { font-size: 17px; font-weight: 800; color: var(--text-primary); }

.readiness-badge { font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 8px; white-space: nowrap; }
.readiness-badge--ready { background: var(--green-light); color: var(--green); }
.readiness-badge--not   { background: var(--red-light);   color: var(--red); }

.building-report__section { display: flex; flex-direction: column; gap: 8px; }
.building-report__section-label {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-secondary);
}

/* FE table */
.fe-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fe-table th { padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; border-bottom: 2px solid var(--border); }
.fe-table td { padding: 8px 8px; border-bottom: 1px solid var(--divider); }

/* EL summary */
.el-summary { display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: var(--text-secondary); }
.el-note    { font-size: 13px; color: var(--text-secondary); font-style: italic; }

/* Features grid */
.features-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.feature-item  {
  display: flex; gap: 8px; align-items: center;
  padding: 8px 10px; border-radius: 8px; font-size: 13px; font-weight: 600;
}
.feature-item--yes   { background: var(--green-light); color: var(--green); }
.feature-item--no    { background: var(--red-light);   color: var(--red); }
.feature-item--count { background: var(--bg); color: var(--text-primary); border: 1.5px solid var(--border); }

.building-report__remarks { font-size: 13px; color: var(--text-secondary); font-style: italic; }

/* Procurement */
/* .procurement-section { } */
.procurement-note { font-size: 13px; color: var(--text-secondary); }
.procurement-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.procurement-table th { padding: 9px 10px; text-align: left; font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; border-bottom: 2px solid var(--border); }
.procurement-table td { padding: 11px 10px; border-bottom: 1px solid var(--divider); }
.procurement-table tfoot td { border-top: 2px solid var(--border); border-bottom: none; padding-top: 13px; font-size: 15px; }

/* Signatures */
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding-top: 16px; border-top: 1.5px solid var(--border); }
.signature-block { display: flex; flex-direction: column; gap: 5px; }
.signature-block__line { height: 1px; background: var(--text-primary); margin-bottom: 8px; margin-top: 40px; }
.signature-block__name  { font-size: 14px; font-weight: 700; }
.signature-block__role  { font-size: 13px; color: var(--text-secondary); }
.signature-block__label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }

.report-footer { font-size: 12px; color: var(--text-secondary); text-align: center; }

/* Empty prompt */
.empty-prompt { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px; text-align: center; }
.empty-prompt__icon { font-size: 48px; opacity: 0.5; }
.empty-prompt__text { font-size: 15px; color: var(--text-secondary); line-height: 1.6; max-width: 280px; }

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 12px; }

/* Utility */
.text-center { text-align: center; }
.text-right  { text-align: right; }
.text-red    { color: var(--red); }
.text-green  { color: var(--green); }
.text-blue   { color: var(--blue); }
.font-bold   { font-weight: 700; }

@media print {
  .no-print { display: none !important; }
  .bfp-report-page { padding: 0 !important; }
  .report-body { box-shadow: none !important; border-radius: 0 !important; }
  .building-report { page-break-inside: avoid; }
}
</style>
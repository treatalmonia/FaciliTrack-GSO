<template>
  <div class="fs-dashboard">

    <!-- ── Search bar ── -->
    <div class="search-bar-wrap">
      <button class="search-bar" @click="searchStore.openSearch()">
        <span class="search-bar__icon">🔍</span>
        <span class="search-bar__placeholder">Search buildings, units, or suppliers…</span>
      </button>
    </div>

    <!-- ── Alerts ── -->
    <section v-if="hasAlerts" class="alerts-section">
      <p class="section-label">NEEDS ATTENTION</p>

      <button
        v-if="store.expiredUnits.length"
        class="alert-card alert-card--red"
        @click="$router.push({ name: 'ExpiryTracker', query: { tab: 'expired' } })"
      >
        <span class="alert-card__icon">🚨</span>
        <div class="alert-card__body">
          <span class="alert-card__title">
            {{ store.expiredUnits.length }}
            {{ store.expiredUnits.length === 1 ? 'extinguisher' : 'extinguishers' }} already expired
          </span>
          <span class="alert-card__sub">Action required — tap to review</span>
        </div>
        <span class="alert-card__arrow">›</span>
      </button>

      <button
        v-if="store.expiringSoonUnits.length"
        class="alert-card alert-card--amber"
        @click="$router.push({ name: 'ExpiryTracker', query: { tab: 'soon' } })"
      >
        <span class="alert-card__icon">⚠️</span>
        <div class="alert-card__body">
          <span class="alert-card__title">
            {{ store.expiringSoonUnits.length }}
            {{ store.expiringSoonUnits.length === 1 ? 'extinguisher' : 'extinguishers' }}
            expiring within 60 days
          </span>
          <span class="alert-card__sub">Tap to review and schedule refill</span>
        </div>
        <span class="alert-card__arrow">›</span>
      </button>

      <button
        v-if="store.overdueMovements.length"
        class="alert-card alert-card--amber"
        @click="$router.push({ name: 'MovementLog' })"
      >
        <span class="alert-card__icon">📦</span>
        <div class="alert-card__body">
          <span class="alert-card__title">
            {{ store.overdueMovements.length }}
            {{ store.overdueMovements.length === 1 ? 'unit' : 'units' }}
            not yet returned — over 14 days
          </span>
          <span class="alert-card__sub">Tap to view movement log</span>
        </div>
        <span class="alert-card__arrow">›</span>
      </button>

      <button
        v-if="store.notReadyBuildings.length"
        class="alert-card alert-card--amber"
        @click="showNotReadyOnly = true"
      >
        <span class="alert-card__icon">🏢</span>
        <div class="alert-card__body">
          <span class="alert-card__title">
            {{ store.notReadyBuildings.length }} buildings not ready for BFP inspection
          </span>
          <span class="alert-card__sub">Tap to filter the list below</span>
        </div>
        <span class="alert-card__arrow">›</span>
      </button>
    </section>

    <!-- ── Loading ── -->
    <div v-if="store.loading.compliances || store.loading.buildings" class="skeleton-list">
      <div v-for="n in 4" :key="n" class="skeleton" style="height: 64px" />
    </div>

    <template v-else>

      <!-- ── Buildings ── -->
      <div class="buildings-block">
        <div class="buildings-block__header">
          <p class="section-label">BUILDINGS</p>
          <div class="filter-toggle">
            <button
              class="filter-btn"
              :class="{ 'filter-btn--active': !showNotReadyOnly }"
              @click="showNotReadyOnly = false"
            >All</button>
            <button
              class="filter-btn"
              :class="{ 'filter-btn--active': showNotReadyOnly }"
              @click="showNotReadyOnly = true"
            >Not Ready</button>
          </div>
        </div>

        <div v-if="!visibleBuildings.length" class="empty-note">
          No buildings found.
        </div>

        <div v-else class="building-list">
          <button
            v-for="item in visibleBuildings"
            :key="item.building.building_id"
            class="building-row"
            @click="goToBuilding(item.building.building_id)"
          >
            <div class="building-row__left">
              <span class="building-row__name">{{ item.building.building_name }}</span>
              <span class="building-row__gap">{{ buildingGapSummary(item) }}</span>
            </div>
            <div class="building-row__right">
              <span
                class="readiness-badge"
                :class="item.compliance?.bfp_ready ? 'readiness-badge--ready' : 'readiness-badge--not'"
              >
                {{ item.compliance?.bfp_ready ? '✓ READY' : '✗ NOT READY' }}
              </span>
              <span class="building-row__arrow">›</span>
            </div>
          </button>
        </div>
      </div>

      <!-- ── Campus totals ── -->
      <div class="totals-block">
        <p class="section-label">CAMPUS-WIDE TOTALS</p>
        <div class="totals-grid">
          <div class="total-tile">
            <span class="total-tile__number">{{ store.campusTotals.feOnSite }}</span>
            <span class="total-tile__label">Fire extinguishers on campus</span>
          </div>
          <div class="total-tile" :class="feGap > 0 ? 'total-tile--gap' : ''">
            <span class="total-tile__number">{{ feGap > 0 ? feGap : '✓' }}</span>
            <span class="total-tile__label">{{ feGap > 0 ? 'More needed' : 'FE count sufficient' }}</span>
          </div>
          <div class="total-tile">
            <span class="total-tile__number">{{ store.campusTotals.elOnSite }}</span>
            <span class="total-tile__label">Emergency lights deployed</span>
          </div>
          <div class="total-tile" :class="elGap > 0 ? 'total-tile--gap' : ''">
            <span class="total-tile__number">{{ elGap > 0 ? elGap : '✓' }}</span>
            <span class="total-tile__label">{{ elGap > 0 ? 'Lights still needed' : 'Lights sufficient' }}</span>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFireSafetyStore } from '@/stores/firesafety'
import { useSearchStore }     from '@/stores/search'

const router      = useRouter()
const store       = useFireSafetyStore()
const searchStore = useSearchStore()

const showNotReadyOnly = ref(false)

const hasAlerts = computed(() =>
  store.expiredUnits.length > 0 ||
  store.expiringSoonUnits.length > 0 ||
  store.overdueMovements.length > 0 ||
  store.notReadyBuildings.length > 0
)

const feGap = computed(() => Math.max(0, store.campusTotals.feNeeded - store.campusTotals.feOnSite))
const elGap = computed(() => Math.max(0, store.campusTotals.elNeeded - store.campusTotals.elOnSite))

const mergedBuildings = computed(() =>
  store.buildings.map((b) => ({
    building:   b,
    compliance: store.compliances.find((c) => c.building_id === b.building_id) ?? null,
  }))
)

const visibleBuildings = computed(() => {
  if (!showNotReadyOnly.value) return mergedBuildings.value
  return mergedBuildings.value.filter((item) => !item.compliance?.bfp_ready)
})

function buildingGapSummary(item) {
  if (!item.compliance) return 'No fire safety data entered yet'
  if (item.compliance.bfp_ready) return 'Ready for inspection ✓'

  const parts = []
  const comp  = item.compliance
  const floors = store.floorCompliances.filter((f) => f.compliance_id === comp.compliance_id)

  let feGapTotal = 0
  let elGapTotal = 0
  for (const f of floors) {
    feGapTotal +=
      Math.max(0, (f.fe_10lbs_needed ?? 0) - (f.fe_10lbs_on_site ?? 0)) +
      Math.max(0, (f.fe_5lbs_needed  ?? 0) - (f.fe_5lbs_on_site  ?? 0)) +
      Math.max(0, (f.fe_hcfc_needed  ?? 0) - (f.fe_hcfc_on_site  ?? 0))
    elGapTotal += Math.max(0, (f.emergency_lights_needed ?? 0) - (f.emergency_lights_on_site ?? 0))
  }

  if (feGapTotal > 0) parts.push(`Needs ${feGapTotal} more FE unit${feGapTotal === 1 ? '' : 's'}`)
  if (elGapTotal > 0) parts.push(`${elGapTotal} emergency light${elGapTotal === 1 ? '' : 's'} needed`)

  const missingFeatures = []
  if (!comp.fire_hose_cabinet) missingFeatures.push('Fire Hose Cabinet')
  if (!comp.sprinkler_system)  missingFeatures.push('Sprinkler System')
  if (!comp.smoke_detector)    missingFeatures.push('Smoke Detector')
  if (!comp.exit_right)        missingFeatures.push('EXIT RIGHT sign')
  if (!comp.exit_left)         missingFeatures.push('EXIT LEFT sign')
  if (!comp.exit_sign)         missingFeatures.push('EXIT sign')

  if (missingFeatures.length) parts.push(`Missing safety features`)

  return parts.slice(0, 2).join(' · ') || 'Missing safety features'
}

function goToBuilding(buildingId) {
  router.push({ name: 'FireSafetyDetail', params: { id: buildingId } })
}

onMounted(async () => {
  await Promise.all([
    store.fetchBuildings(),
    store.fetchCompliances(),
    store.fetchAllUnits(),
    store.fetchMovements(),
  ])
})
</script>

<style scoped>
.fs-dashboard {
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

/* Alerts */
.alerts-section { display: flex; flex-direction: column; gap: 8px; }
.section-label  { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; color: var(--text-secondary); }

.alert-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; border-radius: 12px; border: none;
  cursor: pointer; text-align: left; width: 100%; min-height: 68px;
  transition: transform 0.1s;
}
.alert-card:active { transform: scale(0.985); }
.alert-card--red   { background: var(--red-light);    border-left: 4px solid var(--red); }
.alert-card--amber { background: var(--yellow-light);  border-left: 4px solid var(--yellow); }
.alert-card__icon  { font-size: 22px; flex-shrink: 0; }
.alert-card__body  { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.alert-card__title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.alert-card__sub   { font-size: 12px; color: var(--text-secondary); }
.alert-card__arrow { font-size: 20px; color: var(--text-secondary); flex-shrink: 0; }

/* Buildings block */
.buildings-block { display: flex; flex-direction: column; gap: 10px; }
.buildings-block__header { display: flex; justify-content: space-between; align-items: center; }

.filter-toggle { display: flex; gap: 6px; }
.filter-btn {
  padding: 7px 14px; border: 2px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text-secondary); font-size: 13px;
  font-weight: 600; cursor: pointer; min-height: 40px;
}
.filter-btn--active { border-color: var(--blue); background: var(--blue-light); color: var(--blue); }

.building-list {
  background: var(--surface);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.building-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 15px 16px; border: none; background: none;
  width: 100%; text-align: left; cursor: pointer; min-height: 64px;
  border-bottom: 1px solid var(--divider); transition: background 0.1s;
}
.building-row:last-child { border-bottom: none; }
.building-row:hover      { background: var(--bg); }

.building-row__left  { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.building-row__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.building-row__name { font-size: 15px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.building-row__gap  { font-size: 12px; color: var(--text-secondary); }
.building-row__arrow{ font-size: 20px; color: var(--text-secondary); }

.readiness-badge { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 8px; white-space: nowrap; }
.readiness-badge--ready { background: var(--green-light); color: var(--green); }
.readiness-badge--not   { background: var(--red-light);   color: var(--red); }

/* Totals */
.totals-block { display: flex; flex-direction: column; gap: 10px; }
.totals-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

.total-tile {
  background: var(--surface); border-radius: 12px; padding: 16px 14px;
  display: flex; flex-direction: column; gap: 4px;
  box-shadow: var(--shadow-sm); border: 2px solid transparent;
}
.total-tile--gap { border-color: var(--red-light); background: var(--red-light); }
.total-tile__number { font-size: 26px; font-weight: 900; color: var(--text-primary); line-height: 1; }
.total-tile--gap .total-tile__number { color: var(--red); }
.total-tile__label  { font-size: 12px; font-weight: 600; color: var(--text-secondary); line-height: 1.4; }

/* Misc */
.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.empty-note    { font-size: 14px; color: var(--text-secondary); font-style: italic; padding: 16px 0; }
</style>
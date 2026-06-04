<template>
  <div class="fs-dashboard">

    <!-- Header -->
    <header class="fs-header">
      <div>
        <h1 class="fs-header__title">Fire Safety</h1>
        <p class="fs-header__subtitle">BFP Inspection Readiness</p>
      </div>
      <button class="reports-link" @click="$router.push({ name: 'BFPReport' })">
        📋 BFP Report
      </button>
    </header>

    <!-- ══ ALERTS SECTION ══ -->
    <section v-if="hasAlerts" class="alerts-section">
      <h2 class="alerts-section__title">Needs Attention</h2>

      <!-- Alert 1: Expired units (CRITICAL) -->
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

      <!-- Alert 2: Expiring soon -->
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

      <!-- Alert 3: Overdue movements -->
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
            removed — location unconfirmed
          </span>
          <span class="alert-card__sub">
            Removed {{ overdueLabel }} — no return or transfer logged
          </span>
        </div>
        <span class="alert-card__arrow">›</span>
      </button>

      <!-- Alert 4: Buildings not ready -->
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
          <span class="alert-card__sub">Tap to view only those buildings</span>
        </div>
        <span class="alert-card__arrow">›</span>
      </button>
    </section>

    <!-- Loading -->
    <div v-if="store.loading.compliances || store.loading.buildings" class="skeleton-list">
      <div class="skeleton" style="height: 80px" />
      <div class="skeleton" style="height: 80px" />
      <div class="skeleton" style="height: 80px" />
    </div>

    <template v-else>
      <!-- ══ BUILDING LIST ══ -->
      <section class="building-section">
        <div class="section-header">
          <h2 class="section-title">Buildings</h2>
          <div class="filter-toggle">
            <button
              class="filter-btn"
              :class="{ 'filter-btn--active': !showNotReadyOnly }"
              @click="showNotReadyOnly = false"
            >
              All
            </button>
            <button
              class="filter-btn"
              :class="{ 'filter-btn--active': showNotReadyOnly }"
              @click="showNotReadyOnly = true"
            >
              Not Ready
            </button>
          </div>
        </div>

        <div v-if="!visibleBuildings.length" class="empty-note">
          No buildings found.
        </div>

        <div v-else class="building-list">
          <button
            v-for="item in visibleBuildings"
            :key="item.building.building_id"
            class="building-card"
            @click="goToBuilding(item.building.building_id)"
          >
            <div class="building-card__left">
              <span class="building-card__name">{{ item.building.building_name }}</span>
              <span v-if="item.compliance" class="building-card__gap">
                {{ buildingGapSummary(item) }}
              </span>
              <span v-else class="building-card__gap building-card__gap--none">
                No fire safety data entered yet
              </span>
            </div>
            <div class="building-card__right">
              <span
                class="readiness-badge"
                :class="item.compliance?.bfp_ready ? 'readiness-badge--ready' : 'readiness-badge--not'"
              >
                {{ item.compliance?.bfp_ready ? '✓ READY' : '✗ NOT READY' }}
              </span>
              <span class="building-card__arrow">›</span>
            </div>
          </button>
        </div>
      </section>

      <!-- ══ CAMPUS TOTALS STRIP ══ -->
      <section class="totals-strip">
        <h2 class="section-title">Campus-wide Totals</h2>
        <div class="totals-grid">
          <div class="total-tile">
            <span class="total-tile__number">{{ store.campusTotals.feOnSite }}</span>
            <span class="total-tile__label">Fire extinguishers on campus</span>
          </div>
          <div class="total-tile" :class="{ 'total-tile--gap': feGap > 0 }">
            <span class="total-tile__number">{{ feGap }}</span>
            <span class="total-tile__label">More needed for full compliance</span>
          </div>
          <div class="total-tile">
            <span class="total-tile__number">{{ store.campusTotals.elOnSite }}</span>
            <span class="total-tile__label">Emergency lights deployed</span>
          </div>
          <div class="total-tile" :class="{ 'total-tile--gap': elGap > 0 }">
            <span class="total-tile__number">{{ elGap }}</span>
            <span class="total-tile__label">Emergency lights still needed</span>
          </div>
        </div>
      </section>
    </template>

    <!-- FAB: Log Movement -->
    <button class="fab" @click="$router.push({ name: 'MovementLog' })">
      📦 Log Movement
    </button>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFireSafetyStore } from '@/stores/firesafety'

const router = useRouter()
const store  = useFireSafetyStore()

const showNotReadyOnly = ref(false)

const hasAlerts = computed(() =>
  store.expiredUnits.length > 0 ||
  store.expiringSoonUnits.length > 0 ||
  store.overdueMovements.length > 0 ||
  store.notReadyBuildings.length > 0
)

const feGap = computed(() =>
  Math.max(0, store.campusTotals.feNeeded - store.campusTotals.feOnSite)
)
const elGap = computed(() =>
  Math.max(0, store.campusTotals.elNeeded - store.campusTotals.elOnSite)
)

/** Merge buildings with their compliance records */
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

/** Overdue movement label (first one) */
const overdueLabel = computed(() => {
  const m = store.overdueMovements[0]
  if (!m) return ''
  return new Date(m.movement_date).toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric',
  })
})

/** One-line gap summary for a building */
function buildingGapSummary(item) {
  if (!item.compliance) return ''
  if (item.compliance.bfp_ready) return 'Ready for inspection ✓'

  const parts = []

  // FE gap — sum across all floors for this building
  const floors = store.floorCompliances.filter(
  (f) => {
    const comp = store.compliances.find((c) => c.building_id === item.building.building_id)
    return comp ? f.compliance_id === comp.compliance_id : false
  }
)
  let feGapTotal = 0
  for (const f of floors) {
    feGapTotal +=
      Math.max(0, (f.fe_10lbs_needed ?? 0) - (f.fe_10lbs_on_site ?? 0)) +
      Math.max(0, (f.fe_5lbs_needed  ?? 0) - (f.fe_5lbs_on_site  ?? 0)) +
      Math.max(0, (f.fe_hcfc_needed  ?? 0) - (f.fe_hcfc_on_site  ?? 0))
  }
  if (feGapTotal > 0) parts.push(`Needs ${feGapTotal} more fire extinguisher${feGapTotal === 1 ? '' : 's'}`)

  const elGapVal = Math.max(
    0,
    (item.compliance.emergency_lights_needed  ?? 0) -
    (item.compliance.emergency_lights_on_site ?? 0)
  )
  if (elGapVal > 0) parts.push(`${elGapVal} emergency light${elGapVal === 1 ? '' : 's'} needed`)

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
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Header */
.fs-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.fs-header__title    { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.fs-header__subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.reports-link {
  flex-shrink: 0;
  padding: 10px 16px;
  background: none;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  min-height: 48px;
}

/* Alerts */
.alerts-section { display: flex; flex-direction: column; gap: 10px; }
.alerts-section__title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}

.alert-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  min-height: 72px;
  transition: transform 0.1s;
}
.alert-card:active { transform: scale(0.985); }

.alert-card--red   { background: var(--red-light);    border-left: 5px solid var(--red); }
.alert-card--amber { background: var(--yellow-light);  border-left: 5px solid var(--yellow); }

.alert-card__icon { font-size: 24px; flex-shrink: 0; }
.alert-card__body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.alert-card__title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.alert-card__sub   { font-size: 13px; color: var(--text-secondary); }
.alert-card__arrow { font-size: 22px; color: var(--text-secondary); flex-shrink: 0; }

/* Building list */
.building-section { display: flex; flex-direction: column; gap: 12px; }

.section-header { display: flex; justify-content: space-between; align-items: center; }
.section-title  { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; }

.filter-toggle { display: flex; gap: 6px; }
.filter-btn {
  padding: 8px 14px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  min-height: 40px;
}
.filter-btn--active { border-color: var(--blue); background: var(--blue-light); color: var(--blue); }

.building-list { display: flex; flex-direction: column; gap: 10px; }

.building-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--surface);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  min-height: 72px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.1s;
}
.building-card:active { transform: scale(0.985); }

.building-card__left  { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.building-card__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.building-card__name  {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.building-card__gap  { font-size: 13px; color: var(--text-secondary); }
.building-card__gap--none { font-style: italic; }
.building-card__arrow { font-size: 22px; color: var(--text-secondary); }

.readiness-badge {
  font-size: 12px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 8px;
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.readiness-badge--ready { background: var(--green-light); color: var(--green); }
.readiness-badge--not   { background: var(--red-light);   color: var(--red); }

.empty-note { font-size: 14px; color: var(--text-secondary); font-style: italic; padding: 16px 0; }

/* Campus totals */
.totals-strip { display: flex; flex-direction: column; gap: 12px; }

.totals-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.total-tile {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--shadow-sm);
  border: 2px solid transparent;
}
.total-tile--gap { border-color: var(--red-light); background: var(--red-light); }

.total-tile__number {
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1;
}
.total-tile--gap .total-tile__number { color: var(--red); }

.total-tile__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 10px; }

/* FAB */
.fab {
  position: fixed;
  bottom: calc(var(--nav-height) + 16px);
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 22px;
  height: 52px;
  background: var(--red);
  color: #fff;
  border: none;
  border-radius: 26px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(192, 57, 43, 0.35);
  z-index: 100;
}
</style>
<template>
  <div class="elec-dashboard">

    <!-- ── Search bar ── -->
    <div class="search-bar-wrap">
      <button class="search-bar" @click="searchStore.openSearch()">
        <span class="search-bar__icon">🔍</span>
        <span class="search-bar__placeholder">Search buildings, rooms, or items…</span>
      </button>
    </div>

    <!-- ── New Request — full width primary action ── -->
    <button class="new-request-btn" @click="$router.push({ name: 'NewRequest' })">
      + New Request
    </button>

    <!-- ── Stats row ── -->
    <div v-if="store.loading.allOpen || loadingStats" class="stats-row">
      <div v-for="n in 3" :key="n" class="skeleton" style="height:80px; flex:1" />
    </div>
    <div v-else class="stats-row">
      <div class="stat-tile" :class="store.totalOpenCount > 0 ? 'stat-tile--red' : 'stat-tile--green'">
        <span class="stat-tile__number">{{ store.totalOpenCount }}</span>
        <span class="stat-tile__label">Open requests</span>
      </div>
      <div class="stat-tile" :class="resolvedThisMonth > 0 ? 'stat-tile--green' : ''">
        <span class="stat-tile__number">{{ resolvedThisMonth }}</span>
        <span class="stat-tile__label">Resolved this month</span>
      </div>
      <div class="stat-tile" :class="buildingsWithIssues > 0 ? 'stat-tile--yellow' : 'stat-tile--green'">
        <span class="stat-tile__number">{{ buildingsWithIssues }}</span>
        <span class="stat-tile__label">Buildings with issues</span>
      </div>
    </div>

    <!-- ── Buildings ── -->
    <div class="buildings-block">
      <p class="section-label">BUILDINGS</p>

      <!-- Loading -->
      <div v-if="store.loading.buildings" class="skeleton-list">
        <div v-for="n in 3" :key="n" class="skeleton" style="height: 68px" />
      </div>

      <!-- Error -->
      <div v-else-if="store.error.buildings" class="error-banner">
        Could not load buildings. Please check your connection and try again.
      </div>

      <!-- Empty -->
      <div v-else-if="!store.buildings.length" class="empty-state">
        <span class="empty-state__icon">🏢</span>
        <p class="empty-state__title">No buildings added yet.</p>
        <p class="empty-state__sub">Start by adding the first building on campus.</p>
        <button class="btn-primary" style="margin-top:8px" @click="showAddBuilding = true">
          Add First Building
        </button>
      </div>

      <!-- Building list -->
      <div v-else class="building-list">
        <button
          v-for="building in store.buildings"
          :key="building.building_id"
          class="building-row"
          @click="goToBuilding(building)"
        >
          <!-- Status dot -->
          <span
            class="building-row__dot"
            :class="getDotClass(building.building_id)"
          />

          <!-- Text -->
          <div class="building-row__text">
            <span class="building-row__name">{{ building.building_name }}</span>
            <span v-if="building.college_or_department" class="building-row__dept">
              {{ building.college_or_department }}
            </span>
          </div>

          <!-- Open count badge -->
          <span
            v-if="(store.openCountByBuilding[building.building_id] ?? 0) > 0"
            class="building-row__badge"
          >
            {{ store.openCountByBuilding[building.building_id] }} open
          </span>

          <span class="building-row__arrow">›</span>
        </button>

        <!-- Add building row -->
        <button class="building-row building-row--add" @click="showAddBuilding = true">
          <span class="building-row__add-icon">＋</span>
          <span class="building-row__add-label">Add Building</span>
        </button>
      </div>
    </div>

    <!-- ── Add Building Dialog ── -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showAddBuilding" class="dialog-overlay" @click.self="showAddBuilding = false">
          <div class="dialog">
            <h2 class="dialog__title">Add Building</h2>

            <div class="field">
              <label class="field__label">Official name of the building *</label>
              <input v-model="newBuilding.building_name" class="field__input" placeholder="e.g., Kinaadman Hall" />
            </div>

            <div class="field">
              <label class="field__label">How many floors?</label>
              <div class="stepper">
                <button type="button" class="stepper__btn" @click="newBuilding.number_of_floors = Math.max(1, newBuilding.number_of_floors - 1)">−</button>
                <span class="stepper__value">{{ newBuilding.number_of_floors }}</span>
                <button type="button" class="stepper__btn" @click="newBuilding.number_of_floors = Math.min(10, newBuilding.number_of_floors + 1)">+</button>
              </div>
            </div>

            <div class="field">
              <label class="field__label">College or office (optional)</label>
              <input v-model="newBuilding.college_or_department" class="field__input" placeholder="e.g., College of Education" />
            </div>

            <p v-if="addBuildingError" class="field__error">{{ addBuildingError }}</p>

            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="showAddBuilding = false">Cancel</button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.addBuilding"
                @click="handleAddBuilding"
              >
                {{ store.loading.addBuilding ? 'Saving…' : 'Add Building' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ToastNotification
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @done="toast.show = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useElectricalStore } from '@/stores/electrical'
import { useSearchStore }     from '@/stores/search'
import { supabase }           from '@/lib/supabase'
import ToastNotification      from '@/components/common/ToastNotification.vue'

const router      = useRouter()
const store       = useElectricalStore()
const searchStore = useSearchStore()

// ── Stats ─────────────────────────────────────────────────────────────────
const resolvedThisMonth = ref(0)
const loadingStats      = ref(false)

const buildingsWithIssues = computed(() =>
  store.buildings.filter(
    (b) => (store.openCountByBuilding[b.building_id] ?? 0) > 0
  ).length
)

async function fetchResolvedThisMonth() {
  loadingStats.value = true
  try {
    const now   = new Date()
    const from  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    
   const { count, error: countErr } = await supabase
  .from('repair_request')
  .select('request_id', { count: 'exact', head: true })
  .eq('status', 'Resolved')
  .gte('date_resolved', from)
if (!countErr) resolvedThisMonth.value = count ?? 0

  } catch (err) {
    console.error('[ElectricalDashboard] fetchResolvedThisMonth:', err)
  } finally {
    loadingStats.value = false
  }
}

// ── Building dot color ─────────────────────────────────────────────────────
function getDotClass(buildingId) {
  const count = store.openCountByBuilding[buildingId] ?? 0
  if (count === 0)   return 'dot--green'
  if (count <= 5)    return 'dot--yellow'
  return 'dot--red'
}

// ── Navigation ─────────────────────────────────────────────────────────────
function goToBuilding(building) {
  router.push({ name: 'BuildingView', params: { id: building.building_id } })
}

// ── Add building ───────────────────────────────────────────────────────────
const showAddBuilding  = ref(false)
const addBuildingError = ref('')
const newBuilding      = ref({ building_name: '', number_of_floors: 1, college_or_department: '' })
const toast            = ref({ show: false, message: '', type: 'success' })

async function handleAddBuilding() {
  addBuildingError.value = ''
  if (!newBuilding.value.building_name.trim()) {
    addBuildingError.value = 'Please enter the building name.'
    return
  }
  const result = await store.addBuilding(newBuilding.value)
  if (result) {
    showAddBuilding.value = false
    newBuilding.value = { building_name: '', number_of_floors: 1, college_or_department: '' }
    toast.value = { show: true, message: 'Building added.', type: 'success' }
  } else {
    addBuildingError.value = store.error.addBuilding ?? 'Failed to add building.'
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    store.fetchBuildings(),
    store.fetchAllOpenRequests(),
    fetchResolvedThisMonth(),
  ])
})
</script>

<style scoped>
.elec-dashboard {
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
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 13px 16px;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  min-height: 52px;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s;
}
.search-bar:hover { border-color: var(--blue); }
.search-bar__icon        { font-size: 18px; opacity: 0.5; flex-shrink: 0; }
.search-bar__placeholder { font-size: 15px; color: var(--text-disabled); }

/* New Request button */
.new-request-btn {
  width: 100%;
  padding: 16px;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: var(--shadow-sm);
  transition: background 0.15s, border-color 0.15s;
}
.new-request-btn:hover { background: var(--blue-light); border-color: var(--blue); color: var(--blue); }

/* Stats row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.stat-tile {
  background: var(--surface);
  border-radius: 12px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  box-shadow: var(--shadow-sm);
  border: 2px solid transparent;
}
.stat-tile--red    { border-color: var(--red-light);    background: var(--red-light); }
.stat-tile--green  { border-color: var(--green-light);  background: var(--green-light); }
.stat-tile--yellow { border-color: var(--yellow-light); background: var(--yellow-light); }

.stat-tile__number {
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1;
}
.stat-tile--red   .stat-tile__number { color: var(--red); }
.stat-tile--green .stat-tile__number { color: var(--green); }
.stat-tile--yellow .stat-tile__number { color: var(--yellow); }

.stat-tile__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.3;
}

/* Buildings block */
.buildings-block { display: flex; flex-direction: column; gap: 10px; }

.section-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.skeleton-list { display: flex; flex-direction: column; gap: 8px; }

.building-list {
  background: var(--surface);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.building-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  min-height: 64px;
  border-bottom: 1px solid var(--divider);
  transition: background 0.1s;
}
.building-row:last-child { border-bottom: none; }
.building-row:hover      { background: var(--bg); }
.building-row:active     { background: var(--blue-light); }

/* Status dot */
.building-row__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--green  { background: var(--green); }
.dot--yellow { background: var(--yellow); }
.dot--red    { background: var(--red); }

.building-row__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.building-row__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.building-row__dept {
  font-size: 12px;
  color: var(--text-secondary);
}

.building-row__badge {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--red-light);
  color: var(--red);
}

.building-row__arrow { font-size: 20px; color: var(--text-secondary); flex-shrink: 0; }

/* Add building row */
.building-row--add { color: var(--blue); }
.building-row__add-icon  { font-size: 18px; color: var(--blue); flex-shrink: 0; }
.building-row__add-label { font-size: 15px; font-weight: 600; color: var(--blue); }

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
  background: var(--surface);
  border-radius: 14px;
}
.empty-state__icon  { font-size: 40px; opacity: 0.4; }
.empty-state__title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.empty-state__sub   { font-size: 14px; color: var(--text-secondary); max-width: 260px; line-height: 1.5; }

/* Stepper */
.stepper { display: flex; align-items: center; gap: 16px; }
.stepper__btn {
  width: 44px; height: 44px; border-radius: 8px;
  border: 2px solid var(--border); background: var(--bg);
  font-size: 20px; font-weight: 700; cursor: pointer; color: var(--text-primary);
}
.stepper__value { font-size: 20px; font-weight: 800; color: var(--text-primary); min-width: 28px; text-align: center; }
</style>
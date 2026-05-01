<template>
  <div class="dashboard">

    <!-- Header -->
    <header class="dashboard__header">
  <div>
    <h1 class="dashboard__title">Electrical Repairs</h1>
    <p class="dashboard__subtitle">Caraga State University — GSO</p>
  </div>
  <button
    class="reports-link"
    @click="$router.push({ name: 'ElectricalReports' })"
  >
    📋 Reports
  </button>
</header>

    <!-- Total open counter -->
    <section class="dashboard__counter">
      <span class="counter__number" :class="{ 'counter__number--alert': totalOpenCount > 0 }">
        {{ store.loading.allOpen ? '…' : totalOpenCount }}
      </span>
      <span class="counter__label">
        {{ totalOpenCount === 1 ? 'unresolved request' : 'unresolved requests' }}
        across all buildings
      </span>
    </section>

    <!-- Error state -->
    <div v-if="store.error.buildings" class="error-banner">
      Could not load buildings. Please check your connection and try again.
    </div>

    <!-- Building list -->
    <section class="dashboard__buildings">
      <div class="section-header">
        <h2 class="section-header__title">Buildings</h2>
        <button class="btn btn--add" @click="showAddBuilding = true">
          + Add Building
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="store.loading.buildings" class="skeleton-list">
        <div v-for="n in 4" :key="n" class="skeleton-card" />
      </div>

      <!-- Empty state -->
      <EmptyState
        v-else-if="!store.buildings.length"
        icon="🏢"
        title="No buildings added yet."
        subtitle="Start by adding the first building on campus."
        action-label="Add First Building"
        @action="showAddBuilding = true"
      />

      <!-- Building cards -->
      <div v-else class="buildings-list">
        <BuildingCard
          v-for="building in store.buildings"
          :key="building.building_id"
          :building="building"
          :open-count="store.openCountByBuilding[building.building_id] ?? 0"
          @click="goToBuilding(building)"
        />
      </div>
    </section>

    <!-- Add Building modal (simple inline form) -->
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
              <label class="field__label">How many floors does this building have? *</label>
              <div class="stepper">
                <button type="button" class="stepper__btn" @click="newBuilding.number_of_floors = Math.max(1, newBuilding.number_of_floors - 1)">−</button>
                <span class="stepper__value">{{ newBuilding.number_of_floors }}</span>
                <button type="button" class="stepper__btn" @click="newBuilding.number_of_floors = Math.min(10, newBuilding.number_of_floors + 1)">+</button>
              </div>
            </div>
            <div class="field">
              <label class="field__label">Which college or office uses this building? (optional)</label>
              <input v-model="newBuilding.college_or_department" class="field__input" placeholder="e.g., College of Education, GSO" />
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

    <!-- New Request FAB -->
    <button class="fab" @click="$router.push({ name: 'NewRequest' })">
      + New Request
    </button>

    <ToastNotification
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @done="toast.show = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useElectricalStore } from '@/stores/electrical'
import BuildingCard      from '@/components/electrical/BuildingCard.vue'
import EmptyState        from '@/components/common/EmptyState.vue'
import ToastNotification from '@/components/common/ToastNotification.vue'
// import { totalOpenCount } from '@/stores/electrical'  // re-export via store //delete for now

const router = useRouter()
const store  = useElectricalStore()
const totalOpenCount = computed(() => store.totalOpenCount)

const showAddBuilding = ref(false)
const addBuildingError = ref('')
const newBuilding = ref({ building_name: '', number_of_floors: 1, college_or_department: '' })

const toast = ref({ show: false, message: '', type: 'success' })

// Bring back the comment
/* Comment for now */ 
// // Use the getter from the store
// const { totalOpenCount } = store

onMounted(async () => {
  await Promise.all([store.fetchBuildings(), store.fetchAllOpenRequests()])
})

function goToBuilding(building) {
  router.push({ name: 'BuildingView', params: { id: building.building_id } })
}

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
</script>

<style scoped>
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
  white-space: nowrap;
}

.dashboard {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 16px 96px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard__header { display: flex; justify-content: space-between; align-items: flex-start; }
.dashboard__title  { font-size: 24px; font-weight: 800; color: var(--text-primary); margin: 0; }
.dashboard__subtitle { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }

/* Counter */
.dashboard__counter {
  background: var(--surface);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}
.counter__number {
  font-size: 56px;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1;
}
.counter__number--alert { color: var(--red); }
.counter__label { font-size: 15px; color: var(--text-secondary); text-align: center; }

/* Section header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-header__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

/* Buildings list */
.buildings-list { display: flex; flex-direction: column; gap: 10px; }

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 10px; }
.skeleton-card {
  height: 72px;
  border-radius: 12px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* Error */
.error-banner {
  background: #fee2e2;
  color: #b91c1c;
  padding: 14px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}

/* FAB */
.fab {
  position: fixed;
  bottom: 80px;
  right: 20px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 28px;
  padding: 14px 22px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  min-height: 52px;
  z-index: 100;
}

/* Add building modal */
.dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000; padding: 24px;
}
.dialog {
  background: var(--surface); border-radius: 16px;
  padding: 28px 24px; width: 100%; max-width: 420px;
  display: flex; flex-direction: column; gap: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.dialog__title { font-size: 18px; font-weight: 700; margin: 0; color: var(--text-primary); }
.dialog__actions { display: flex; gap: 12px; justify-content: flex-end; }
.dialog__btn { padding: 12px 20px; border-radius: 8px; border: none; font-size: 15px; font-weight: 600; cursor: pointer; min-height: 48px; }
.dialog__btn--cancel  { background: var(--bg); color: var(--text-secondary); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__input { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; min-height: 44px; width: 100%; box-sizing: border-box; }
.field__error { font-size: 13px; color: var(--red); margin: 0; }

/* Stepper */
.stepper { display: flex; align-items: center; gap: 16px; }
.stepper__btn {
  width: 44px; height: 44px; border-radius: 8px;
  border: 2px solid var(--border); background: var(--bg);
  font-size: 20px; font-weight: 700; cursor: pointer; color: var(--text-primary);
}
.stepper__value { font-size: 20px; font-weight: 800; color: var(--text-primary); min-width: 24px; text-align: center; }

/* Transition */
.dialog-enter-active, .dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: scale(0.96); }

/* Buttons */
.btn--add {
  padding: 10px 16px; background: var(--surface); border: 2px solid var(--border);
  border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: var(--text-primary);
  min-height: 48px;
}
</style>

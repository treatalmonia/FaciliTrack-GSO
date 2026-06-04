<template>
  <div class="movement-page">

    <header class="movement-header">
      <h1 class="movement-header__title">Movement History</h1>
      <p class="movement-header__subtitle">Every time an extinguisher is moved, it is logged here.</p>
    </header>

    <!-- Log a Movement button -->
    <button class="btn-primary log-btn" @click="showLogForm = true">
      + Log a Movement
    </button>

    <!-- Loading -->
    <div v-if="store.loading.movements" class="skeleton-list">
      <div v-for="n in 3" :key="n" class="skeleton" style="height: 100px" />
    </div>

    <!-- Error -->
    <div v-else-if="store.error.movements" class="error-banner">
      Could not load movement history. Please try again.
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.movements.length" class="empty-state">
      <span class="empty-state__icon">📦</span>
      <p class="empty-state__title">No movements logged yet.</p>
      <p class="empty-state__subtitle">
        Every time an extinguisher is removed, transferred, refilled, or returned,
        log it here so building counts stay accurate.
      </p>
    </div>

    <!-- Movement log list -->
    <div v-else class="movements-list">
      <div
        v-for="m in store.movements"
        :key="m.movement_id"
        class="movement-card"
        :class="{ 'movement-card--pending': m.status === 'Pending Return' }"
      >
        <!-- Top row: type + date -->
        <div class="movement-card__top">
          <span class="movement-type-badge" :class="movementTypeClass(m.movement_type)">
            {{ m.movement_type }}
          </span>
          <span class="movement-card__date">{{ formatDate(m.movement_date) }}</span>
        </div>

        <!-- Unit description -->
        <div class="movement-card__unit">
          <strong>{{ feLabel(m.fe_size) }}</strong>
          <span v-if="m.quantity_moved > 1"> × {{ m.quantity_moved }} units</span>
        </div>

        <!-- From → To -->
        <div class="movement-card__route">
          <div class="route-point">
            <span class="route-point__label">From</span>
            <span class="route-point__value">
              {{ m.from_building?.building_name ?? '—' }}
              <span v-if="m.from_floor" class="route-sub"> · {{ m.from_floor }}</span>
              <span v-if="m.from_room"  class="route-sub"> · {{ m.from_room }}</span>
            </span>
          </div>
          <span class="route-arrow">→</span>
          <div class="route-point">
            <span class="route-point__label">To</span>
            <span class="route-point__value">
              <template v-if="m.to_supplier">
                {{ m.to_supplier }}
              </template>
              <template v-else-if="m.to_building">
                {{ m.to_building.building_name }}
                <span v-if="m.to_floor" class="route-sub"> · {{ m.to_floor }}</span>
              </template>
              <template v-else>
                <em class="text-secondary">Return date not set (tap to update)</em>
              </template>
            </span>
          </div>
        </div>

        <!-- Count effect -->
        <div v-if="m.count_before !== null && m.count_after !== null" class="count-effect">
          {{ m.from_building?.building_name }}: {{ m.count_before }} → {{ m.count_after }} units
        </div>

        <!-- Status + expected return -->
        <div class="movement-card__footer">
          <span
            class="status-badge"
            :class="m.status === 'Complete' ? 'status-badge--green' : 'status-badge--amber'"
          >
            {{ m.status }}
          </span>
          <span v-if="m.expected_return_date" class="movement-card__return">
            Expected back: {{ formatDate(m.expected_return_date) }}
          </span>
        </div>

        <p v-if="m.notes" class="movement-card__notes">{{ m.notes }}</p>
      </div>
    </div>

    <!-- ══ Log Movement Form Dialog ══ -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showLogForm" class="dialog-overlay" @click.self="closeForm">
          <div class="dialog dialog--large">
            <h2 class="dialog__title">Log a Movement</h2>

            <!-- Step 1: What happened? -->
            <div class="field">
              <label class="field__label">What happened? <span class="field__req">*</span></label>
              <div class="movement-type-btns">
                <button
                  v-for="type in movementTypes"
                  :key="type.value"
                  class="type-btn"
                  :class="{ 'type-btn--active': form.movement_type === type.value }"
                  @click="form.movement_type = type.value"
                >
                  <span class="type-btn__icon">{{ type.icon }}</span>
                  <span class="type-btn__label">{{ type.label }}</span>
                </button>
              </div>
            </div>

            <!-- Step 2: Date -->
            <div class="field">
              <label class="field__label">When did this happen?</label>
              <input v-model="form.movement_date" type="date" class="field__input" :max="todayStr" />
            </div>

            <!-- Step 3: Unit details -->
            <div class="field">
              <label class="field__label">Extinguisher size <span class="field__req">*</span></label>
              <div class="size-btns">
                <button
                  v-for="size in feSizes"
                  :key="size.value"
                  class="choice-btn"
                  :class="{ 'choice-btn--active': form.fe_size === size.value }"
                  @click="form.fe_size = size.value"
                >{{ size.label }}</button>
              </div>
            </div>

            <div class="field">
              <label class="field__label">How many units?</label>
              <input v-model.number="form.quantity_moved" type="number" class="field__input" min="1" />
            </div>

            <!-- Step 4: From building -->
            <div class="field">
              <label class="field__label">Taken from which building? <span class="field__req">*</span></label>
              <select v-model="form.from_building_id" class="field__select" @change="form.from_floor = ''">
                <option value="" disabled>Select building</option>
                <option
                  v-for="b in store.buildings"
                  :key="b.building_id"
                  :value="b.building_id"
                >{{ b.building_name }}</option>
              </select>
            </div>

            <div class="field" v-if="form.from_building_id">
              <label class="field__label">Which floor?</label>
              <select v-model="form.from_floor" class="field__select">
                <option value="" disabled>Select floor</option>
                <option v-for="f in fromBuildingFloors" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>

            <div class="field" v-if="form.from_floor">
              <label class="field__label">Room or location (optional)</label>
              <input v-model="form.from_room" class="field__input" placeholder="e.g., BH 117 — CRÈME, Hallway" />
            </div>

            <!-- Step 5: Destination — conditional on movement type -->
            <template v-if="showDestination">
              <div class="field">
                <label class="field__label">Destination</label>
                <div class="destination-btns">
                  <button
                    v-for="dest in destinationOptions"
                    :key="dest.value"
                    class="choice-btn"
                    :class="{ 'choice-btn--active': form.destination_type === dest.value }"
                    @click="form.destination_type = dest.value"
                  >{{ dest.label }}</button>
                </div>
              </div>

              <!-- Another building -->
              <template v-if="form.destination_type === 'building'">
                <div class="field">
                  <label class="field__label">Which building?</label>
                  <select v-model="form.to_building_id" class="field__select">
                    <option value="" disabled>Select building</option>
                    <option
                      v-for="b in store.buildings"
                      :key="b.building_id"
                      :value="b.building_id"
                    >{{ b.building_name }}</option>
                  </select>
                </div>
                <div class="field" v-if="form.to_building_id">
                  <label class="field__label">Which floor?</label>
                  <select v-model="form.to_floor" class="field__select">
                    <option value="" disabled>Select floor</option>
                    <option v-for="f in toFloors" :key="f" :value="f">{{ f }}</option>
                  </select>
                </div>
              </template>

              <!-- Supplier -->
              <template v-if="form.destination_type === 'supplier'">
                <div class="field">
                  <label class="field__label">Supplier name</label>
                  <input v-model="form.to_supplier" class="field__input" />
                </div>
                <div class="field">
                  <label class="field__label">Reason</label>
                  <div class="destination-btns">
                    <button
                      v-for="r in supplierReasons"
                      :key="r"
                      class="choice-btn"
                      :class="{ 'choice-btn--active': form.supplier_reason === r }"
                      @click="form.supplier_reason = r"
                    >{{ r }}</button>
                  </div>
                </div>
              </template>
            </template>

            <!-- Step 6: Expected return date (for removals/supplier) -->
            <div
              v-if="form.movement_type === 'Removed' || form.movement_type === 'Sent for Refill'"
              class="field"
            >
              <label class="field__label">When do you expect it back? (optional)</label>
              <input v-model="form.expected_return_date" type="date" class="field__input" />
            </div>

            <!-- Step 7: Notes -->
            <div class="field">
              <label class="field__label">Any other details? (optional)</label>
              <textarea v-model="form.notes" class="field__textarea" rows="2" placeholder="e.g., Sent to TRI J&A for refill. Warranty issue." />
            </div>

            <p v-if="formError" class="field__error">{{ formError }}</p>

            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="closeForm">Cancel</button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.logMovement"
                @click="handleSubmit"
              >
                {{ store.loading.logMovement ? 'Saving…' : 'Save Movement' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Post-save confirmation -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showConfirm" class="dialog-overlay">
          <div class="dialog">
            <div class="confirm-icon">✓</div>
            <h2 class="dialog__title">Movement saved.</h2>
            <p class="dialog__body">{{ confirmMessage }}</p>
            <button class="dialog__btn dialog__btn--confirm" style="width:100%" @click="showConfirm = false">
              Done
            </button>
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
import { useFireSafetyStore } from '@/stores/firesafety'
import ToastNotification from '@/components/common/ToastNotification.vue'

const store    = useFireSafetyStore()
const todayStr = new Date().toISOString().split('T')[0]

const FLOOR_LABELS = [
  'Ground Floor','2nd Floor','3rd Floor','4th Floor','5th Floor',
  '6th Floor','7th Floor','8th Floor','9th Floor','10th Floor',
]

// ── Movement type config ──────────────────────────────────────────────────
const movementTypes = [
  { value: 'Removed',                  label: 'Removed from Building',          icon: '⬆' },
  { value: 'Sent for Refill',          label: 'Sent for Refill',                icon: '🔄' },
  { value: 'Transferred',              label: 'Transferred to Another Building', icon: '🔀' },
  { value: 'Returned',                 label: 'Returned / Installed',           icon: '⬇' },
  { value: 'New Unit Added',           label: 'New Unit Purchased',             icon: '🆕' },
]

const feSizes = [
  { value: '5lbs',  label: '5 lbs' },
  { value: '10lbs', label: '10 lbs' },
  { value: 'HCFC',  label: 'HCFC (server rooms)' },
]

const destinationOptions = [
  { value: 'building', label: 'Another Building' },
  { value: 'supplier', label: 'Supplier — TRI J&A' },
  { value: 'same',     label: 'Back to Same Building' },
]

const supplierReasons = ['Refill', 'Repair', 'Return under warranty']

// ── Form state ────────────────────────────────────────────────────────────
const showLogForm = ref(false)
const formError   = ref('')
const showConfirm = ref(false)
const confirmMessage = ref('')
const toast = ref({ show: false, message: '', type: 'success' })

const form = ref(defaultForm())

function defaultForm() {
  return {
    movement_type:        '',
    movement_date:        todayStr,
    fe_size:              '',
    quantity_moved:       1,
    from_building_id:     '',
    from_floor:           '',
    from_room:            '',
    destination_type:     '',
    to_building_id:       '',
    to_floor:             '',
    to_supplier:          'TRI J&A',
    supplier_reason:      '',
    expected_return_date: '',
    notes:                '',
  }
}

function closeForm() {
  showLogForm.value = false
  form.value = defaultForm()
  formError.value = ''
}

// ── Derived: show destination section ────────────────────────────────────
const showDestination = computed(() =>
  ['Transferred', 'Returned', 'New Unit Added'].includes(form.value.movement_type)
)

// ── Floor lists ──────────────────────────────────────────────────────────
const fromBuildingFloors = computed(() => {
  const b = store.buildings.find((b) => b.building_id === form.value.from_building_id)
  return b ? FLOOR_LABELS.slice(0, b.number_of_floors) : []
})

const toFloors = computed(() => {
  const b = store.buildings.find((b) => b.building_id === form.value.to_building_id)
  return b ? FLOOR_LABELS.slice(0, b.number_of_floors) : []
})

// ── Submit ────────────────────────────────────────────────────────────────
async function handleSubmit() {
  formError.value = ''

  if (!form.value.movement_type)    { formError.value = 'Please select what happened.'; return }
  if (!form.value.fe_size)          { formError.value = 'Please select the extinguisher size.'; return }
  if (!form.value.from_building_id) { formError.value = 'Please select the source building.'; return }
  if (!form.value.from_floor) { formError.value = 'Please select which floor it was taken from.'; return }
if (!form.value.from_room.trim()) { formError.value = 'Please enter the room or location it was taken from.'; return }

  // Build destination fields
  let to_building_id = null, to_floor = null, to_supplier = null, status = 'Complete'

  if (form.value.movement_type === 'Removed') {
    status = 'Pending Return'
  } else if (form.value.movement_type === 'Sent for Refill') {
    to_supplier = form.value.to_supplier
    status = 'Pending Return'
  } else if (form.value.destination_type === 'building') {
    to_building_id = form.value.to_building_id
    to_floor       = form.value.to_floor
  } else if (form.value.destination_type === 'supplier') {
    to_supplier = form.value.to_supplier
    status = 'Pending Return'
  }

  // Get count_before for the source floor
  const sourceCompliance = store.compliances.find((c) => c.building_id === form.value.from_building_id)
  const sourceFloor = sourceCompliance
    ? store.floorCompliances.find(
        (f) => f.compliance_id === sourceCompliance.compliance_id && f.floor_level === form.value.from_floor
      )
    : null
  const sizeOnSiteKey = { '10lbs': 'fe_10lbs_on_site', '5lbs': 'fe_5lbs_on_site', 'HCFC': 'fe_hcfc_on_site' }[form.value.fe_size]
  const countBefore = sourceFloor?.[sizeOnSiteKey] ?? 0
  const countAfter  = Math.max(0, countBefore - form.value.quantity_moved)

  const matchedUnit = store.units.find(
    (u) =>
      u.building_id === form.value.from_building_id &&
      u.floor_level === form.value.from_floor &&
      u.fe_size === form.value.fe_size
  )
  if (!matchedUnit) {
    formError.value = 'No matching unit found for this building/floor/size. Please check the Extinguisher Units tab first.'
    return
  }

  const result = await store.logMovement({
    unit_id: matchedUnit.unit_id,
    movement_type:        form.value.movement_type,
    movement_date:        form.value.movement_date,
    fe_size:              form.value.fe_size,
    quantity_moved:       form.value.quantity_moved,
    from_building_id:     form.value.from_building_id,
    from_floor:           form.value.from_floor,
    from_room:            form.value.from_room || null,
    to_building_id,
    to_floor,
    to_supplier,
    expected_return_date: form.value.expected_return_date || null,
    notes:                form.value.notes || null,
    status,
    count_before:         countBefore,
    count_after:          countAfter,
  })

  if (result) {
    const fromBuilding = store.buildings.find((b) => b.building_id === form.value.from_building_id)
    confirmMessage.value = countBefore !== null
      ? `${fromBuilding?.building_name ?? ''} — ${form.value.from_floor} now has ${countAfter} extinguisher${countAfter === 1 ? '' : 's'}. (was ${countBefore})`
      : 'Movement logged successfully.'

    closeForm()
    showConfirm.value = true
  } else {
    formError.value = store.error.logMovement ?? 'Failed to save movement. Please try again.'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function feLabel(size) {
  if (!size) return '—'
  if (size === 'HCFC') return 'HCFC (server rooms)'
  return `${size} Fire Extinguisher`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function movementTypeClass(type) {
  const map = {
    'Removed':                 'type--removed',
    'Sent for Refill':         'type--refill',
    'Transferred':             'type--transfer',
    'Returned':                'type--returned',
    'New Unit Added':          'type--new',
  }
  return map[type] ?? ''
}

onMounted(async () => {
  await Promise.all([
    store.fetchMovements(),
    store.buildings.length ? Promise.resolve() : store.fetchBuildings(),
    store.floorCompliances.length ? Promise.resolve() : store.fetchCompliances(),
    store.units.length            ? Promise.resolve() : store.fetchAllUnits(),
  ])
})
</script>

<style scoped>
.movement-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.movement-header__title    { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.movement-header__subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 2px; }

.log-btn { width: 100%; }

/* Movement cards */
.movements-list { display: flex; flex-direction: column; gap: 10px; }

.movement-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--border);
}
.movement-card--pending { border-left-color: var(--yellow); }

.movement-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.movement-type-badge {
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 8px;
  letter-spacing: 0.02em;
}
.type--removed  { background: var(--red-light);    color: var(--red); }
.type--refill   { background: var(--blue-light);   color: var(--blue); }
.type--transfer { background: var(--yellow-light); color: var(--yellow); }
.type--returned { background: var(--green-light);  color: var(--green); }
.type--new      { background: #ede9fe;             color: #6d28d9; }

.movement-card__date { font-size: 13px; color: var(--text-secondary); white-space: nowrap; }
.movement-card__unit { font-size: 15px; color: var(--text-primary); }

.movement-card__route {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.route-point { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 100px; }
.route-point__label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-secondary); }
.route-point__value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.route-sub { font-size: 13px; color: var(--text-secondary); }
.route-arrow { font-size: 20px; color: var(--text-secondary); padding-top: 14px; }

.count-effect {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg);
  padding: 6px 10px;
  border-radius: 6px;
}

.movement-card__footer {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-badge {
  font-size: 12px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 20px;
}
.status-badge--green { background: var(--green-light); color: var(--green); }
.status-badge--amber { background: var(--yellow-light); color: var(--yellow); }

.movement-card__return { font-size: 13px; color: var(--text-secondary); }
.movement-card__notes  { font-size: 13px; color: var(--text-secondary); font-style: italic; }

/* Empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px; text-align: center; }
.empty-state__icon     { font-size: 48px; opacity: 0.5; }
.empty-state__title    { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; }
.empty-state__subtitle { font-size: 14px; color: var(--text-secondary); max-width: 280px; line-height: 1.6; }

/* Movement type buttons */
.movement-type-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  cursor: pointer;
  min-height: 72px;
  transition: all 0.15s;
}
.type-btn--active { border-color: var(--blue); background: var(--blue-light); }
.type-btn__icon  { font-size: 22px; }
.type-btn__label { font-size: 12px; font-weight: 600; color: var(--text-primary); text-align: center; line-height: 1.3; }

/* Size + destination + choice buttons */
.size-btns, .destination-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.choice-btn {
  padding: 10px 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
}
.choice-btn--active { border-color: var(--blue); background: var(--blue-light); color: var(--blue); }

/* Post-save confirm */
.confirm-icon { font-size: 48px; text-align: center; }
.text-secondary { color: var(--text-secondary); }

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 10px; }

/* Dialog */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 9000; padding: 0; }
.dialog {
  background: var(--surface); border-radius: 20px 20px 0 0; padding: 28px 24px 40px;
  width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: 16px;
  max-height: 92vh; overflow-y: auto; box-shadow: var(--shadow-lg);
}
.dialog--large { max-height: 94vh; }
.dialog__title { font-size: 18px; font-weight: 800; margin: 0; color: var(--text-primary); }
.dialog__body  { font-size: 15px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.dialog__actions { display: flex; gap: 10px; justify-content: flex-end; }
.dialog__btn { padding: 12px 20px; border-radius: 10px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; min-height: 48px; }
.dialog__btn--cancel  { background: var(--bg); color: var(--text-secondary); border: 2px solid var(--border); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn:disabled { opacity: 0.45; cursor: not-allowed; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__req   { color: var(--red); }
.field__input, .field__select { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; min-height: 48px; width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text-primary); }
.field__textarea { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; width: 100%; box-sizing: border-box; resize: vertical; min-height: 72px; }
.field__error { font-size: 13px; color: var(--red); font-weight: 600; }

.dialog-enter-active, .dialog-leave-active { transition: all 0.25s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: translateY(30px); }
</style>
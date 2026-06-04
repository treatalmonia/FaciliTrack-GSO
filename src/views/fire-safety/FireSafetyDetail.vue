<template>
  <div class="fsd-page">

    <div class="page-header">
      <button class="back-btn" @click="$router.back()">‹ Back</button>
      <!-- Cross-module link -->
      <button
        class="cross-link"
        @click="$router.push({ name: 'BuildingView', params: { id: props.id } })"
      >
        ⚡ View Electrical Status
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading.currentBuilding" class="skeleton-list">
      <div class="skeleton" style="height: 80px" />
      <div class="skeleton" style="height: 160px" />
      <div class="skeleton" style="height: 240px" />
    </div>

    <template v-else-if="building">

      <!-- ── Header ── -->
      <header class="fsd-header">
        <div>
          <h1 class="fsd-header__name">{{ building.building_name }}</h1>
          <p v-if="building.college_or_department" class="fsd-header__dept">
            {{ building.college_or_department }}
          </p>
        </div>
        <div class="fsd-header__badge">
          <button
            class="readiness-badge"
            :class="compliance?.bfp_ready ? 'readiness-badge--ready' : 'readiness-badge--not'"
            :disabled="store.loading.saveCompliance"
            @click="handleBFPToggle"
          >
            {{ compliance?.bfp_ready ? '✓ BFP READY — Tap to unmark' : '✗ NOT READY — Tap to mark ready' }}
          </button>
          <span class="fsd-header__updated">
            Last updated: {{ formatDate(compliance?.last_updated_date) }}
          </span>
        </div>
      </header>

      <!-- ── Not Ready Banner ── -->
      <div v-if="!compliance?.bfp_ready && missingItems.length" class="not-ready-banner">
        <span class="not-ready-banner__icon">✗</span>
        <div>
          <p class="not-ready-banner__title">Not Ready for BFP Inspection</p>
          <p class="not-ready-banner__details">Needs: {{ missingItems.join(', ') }}</p>
        </div>
      </div>

      <!-- ── Section 1: Fire Extinguisher Count by Floor ── -->
      <section class="card-section">
        <div class="section-header">
          <h2 class="section-title">Fire Extinguishers by Floor</h2>
          <button class="btn-ghost btn-sm" @click="$router.push({ name: 'MovementLog' })">
            + Log Movement
          </button>
        </div>

        <div v-if="!store.currentFloorCompliances.length" class="empty-note-action">
  <p class="empty-note-action__text">
    No floor records yet. Set up floors first before entering extinguisher counts.
  </p>
  <button
    class="btn-primary"
    :disabled="initializingFloors"
    @click="initializeFloors"
  >
    {{ initializingFloors ? 'Setting up…' : 'Set Up Floors for This Building' }}
  </button>
</div>

        <div v-else class="floor-fe-list">
          <div
  v-for="floor in store.currentFloorCompliances"
  :key="floor.floor_compliance_id"
  class="floor-fe-card card"
>
            <h3 class="floor-fe-card__title">{{ floor.floor_level }}</h3>

            <div class="fe-type-row" v-for="type in feTypes" :key="type.key">
              <span class="fe-type-row__label">{{ type.label }}</span>
              <div class="fe-type-row__counts">
                <span class="fe-count">On site: <strong>{{ floor[type.onSite] ?? 0 }}</strong></span>
                <span class="fe-count">Needed: <strong>{{ floor[type.needed] ?? 0 }}</strong></span>
                <span
                  class="fe-gap"
                  :class="feGap(floor, type) > 0 ? 'fe-gap--red' : 'fe-gap--ok'"
                >
                  Gap: {{ feGap(floor, type) > 0 ? feGap(floor, type) : '✓' }}
                </span>
              </div>
            </div>

            <!-- Edit floor counts inline -->
            <button class="edit-floor-btn" @click="openFloorEdit(floor)">
              ✏ Edit Counts
            </button>
          </div>
        </div>
      </section>

      <!-- ── Section 2: Emergency Lights ── -->
      <section class="card-section">
        <h2 class="section-title">Emergency Lights</h2>
        <div class="card el-card">
          <div class="el-row">
            <div class="el-stat">
              <span class="el-stat__number">{{ compliance?.emergency_lights_on_site ?? 0 }}</span>
              <span class="el-stat__label">On site</span>
            </div>
            <div class="el-divider" />
            <div class="el-stat">
              <span class="el-stat__number">{{ compliance?.emergency_lights_needed ?? 0 }}</span>
              <span class="el-stat__label">Needed</span>
            </div>
            <div class="el-divider" />
            <div class="el-stat" :class="elGap > 0 ? 'el-stat--red' : 'el-stat--green'">
              <span class="el-stat__number">{{ elGap > 0 ? elGap : '✓' }}</span>
              <span class="el-stat__label">{{ elGap > 0 ? 'Still needed' : 'Sufficient' }}</span>
            </div>
          </div>
          <p v-if="compliance?.emergency_lights_notes" class="el-notes">
            Note: {{ compliance.emergency_lights_notes }}
          </p>
          <button class="edit-floor-btn" @click="openELEdit">✏ Edit Counts</button>
        </div>
      </section>

      <!-- ── Section 3: Binary Compliance Checklist ── -->
      <section class="card-section">
        <h2 class="section-title">Safety Requirements</h2>
        <div class="card checklist-card">

          <!-- Binary toggles -->
          <div v-for="item in binaryFeatures" :key="item.field" class="checklist-item">
            <span class="checklist-item__label">{{ item.label }}</span>
            <button
              class="toggle-btn"
              :class="compliance?.[item.field] ? 'toggle-btn--yes' : 'toggle-btn--no'"
              :disabled="store.loading.saveCompliance"
              @click="handleToggle(item.field, !compliance?.[item.field])"
            >
              {{ compliance?.[item.field] ? 'YES' : 'NO' }}
            </button>
          </div>

          <!-- Count fields -->
          <div class="checklist-item">
            <span class="checklist-item__label">Evacuation Plan Boards</span>
            <div class="stepper">
              <button
                class="stepper__btn"
                @click="handleCountChange('evacuation_plan_count', Math.max(0, (compliance?.evacuation_plan_count ?? 0) - 1))"
              >−</button>
              <span class="stepper__value">{{ compliance?.evacuation_plan_count ?? 0 }}</span>
              <button
                class="stepper__btn"
                @click="handleCountChange('evacuation_plan_count', (compliance?.evacuation_plan_count ?? 0) + 1)"
              >+</button>
            </div>
          </div>

          <div class="checklist-item">
            <span class="checklist-item__label">LED EXIT Signs</span>
            <div class="stepper">
              <button
                class="stepper__btn"
                @click="handleCountChange('led_exit_count', Math.max(0, (compliance?.led_exit_count ?? 0) - 1))"
              >−</button>
              <span class="stepper__value">{{ compliance?.led_exit_count ?? 0 }}</span>
              <button
                class="stepper__btn"
                @click="handleCountChange('led_exit_count', (compliance?.led_exit_count ?? 0) + 1)"
              >+</button>
            </div>
          </div>

          <!-- Inline saved toast -->
          <Transition name="fade">
            <span v-if="checklistSaved" class="checklist-saved">Saved ✓</span>
          </Transition>
        </div>
      </section>

      <!-- ── Section 4: Individual Extinguisher Units ── -->
      <section class="card-section">
        <h2 class="section-title">Extinguisher Units in This Building</h2>

        <div v-if="!store.currentUnits.length" class="empty-note">
          No individual unit records for this building yet.
        </div>

        <div v-else class="units-list">
          <div
            v-for="unit in store.currentUnits"
            :key="unit.unit_id"
            class="unit-card card"
          >
            <div class="unit-card__header">
              <div>
                <span class="unit-card__location">
                  {{ unit.floor_level }} — {{ unit.room_location }}
                </span>
                <span class="unit-card__type">
                  {{ feLabel(unit.fe_size) }} · {{ unit.installation_type }}
                  <span v-if="unit.quantity_at_location > 1"> × {{ unit.quantity_at_location }}</span>
                </span>
              </div>
              <span class="condition-badge" :class="conditionClass(unit.current_condition)">
                {{ unit.current_condition }}
              </span>
            </div>

            <div class="unit-card__expiry" :class="store.getExpiryClass(unit.date_expires)">
              <span>Expires: {{ formatDate(unit.date_expires) }}</span>
              <span class="expiry-days">{{ store.getDaysLabel(unit.date_expires) }}</span>
            </div>

            <button class="log-action-btn" @click="openConditionForm(unit)">
              Log Action
            </button>
          </div>
        </div>
      </section>

    </template>

    <!-- ── Floor Edit Dialog ── -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showFloorEdit" class="dialog-overlay" @click.self="showFloorEdit = false">
          <div class="dialog">
            <div class="field-group">
  <p class="field-group__label">Emergency Lights</p>
  <div class="field-group__row">
    <div class="field">
      <label class="field__label">On site</label>
      <input v-model.number="floorEditForm.emergency_lights_on_site" type="number" class="field__input" min="0" />
    </div>
    <div class="field">
      <label class="field__label">Needed</label>
      <input v-model.number="floorEditForm.emergency_lights_needed" type="number" class="field__input" min="0" />
    </div>
  </div>
</div>

            <div v-for="type in feTypes" :key="type.key" class="field-group">
              <p class="field-group__label">{{ type.label }}</p>
              <div class="field-group__row">
                <div class="field">
                  <label class="field__label">On site</label>
                  <input v-model.number="floorEditForm[type.onSite]" type="number" class="field__input" min="0" />
                </div>
                <div class="field">
                  <label class="field__label">Needed</label>
                  <input v-model.number="floorEditForm[type.needed]" type="number" class="field__input" min="0" />
                </div>
              </div>
            </div>

            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="showFloorEdit = false">Cancel</button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.saveFloorFE"
                @click="handleFloorSave"
              >
                {{ store.loading.saveFloorFE ? 'Saving…' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Emergency Lights Edit Dialog ── -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showEditEL" class="dialog-overlay" @click.self="showEditEL = false">
          <div class="dialog">
            <h2 class="dialog__title">Edit Emergency Lights</h2>
            <div class="field">
              <label class="field__label">On site</label>
              <input v-model.number="elForm.on_site" type="number" class="field__input" min="0" />
            </div>
            <div class="field">
              <label class="field__label">Needed</label>
              <input v-model.number="elForm.needed" type="number" class="field__input" min="0" />
            </div>
            <div class="field">
              <label class="field__label">Notes (optional)</label>
              <textarea v-model="elForm.notes" class="field__textarea" rows="2" placeholder="e.g., No electrical outlets in hallways" />
            </div>
            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="showEditEL = false">Cancel</button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.saveCompliance"
                @click="handleELSave"
              >
                {{ store.loading.saveCompliance ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Condition Form Dialog ── -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showConditionForm" class="dialog-overlay" @click.self="showConditionForm = false">
          <div class="dialog">
            <h2 class="dialog__title">Log Action</h2>
            <p class="dialog__body">
              {{ conditionUnit?.floor_level }} — {{ conditionUnit?.room_location }}
              <br />
              <strong>{{ feLabel(conditionUnit?.fe_size) }}</strong>
            </p>

            <div class="field">
              <label class="field__label">New condition</label>
              <div class="condition-btns">
                <button
                  v-for="c in conditions"
                  :key="c"
                  class="condition-btn"
                  :class="{ 'condition-btn--active': conditionForm.condition === c }"
                  @click="conditionForm.condition = c"
                >
                  {{ c }}
                </button>
              </div>
            </div>

            <!-- Refill toggle — shown when condition is FULL -->
<div v-if="conditionForm.condition === 'FULL'" class="field">
  <label class="field__label">Is this a refill?</label>
  <div class="warranty-btns">
    <button
      class="condition-btn"
      :class="{ 'condition-btn--active': conditionForm.isRefill }"
      @click="conditionForm.isRefill = true"
    >Yes — log refill details</button>
    <button
      class="condition-btn"
      :class="{ 'condition-btn--active': conditionForm.isRefill === false }"
      @click="conditionForm.isRefill = false"
    >No — just update condition</button>
  </div>
</div>

<!-- Refilled fields -->
<template v-if="conditionForm.condition === 'FULL' && conditionForm.isRefill">
              <div class="field">
                <label class="field__label">Date refilled</label>
                <input
                  v-model="conditionForm.date_refilled"
                  type="date"
                  class="field__input"
                  :max="todayStr"
                />
              </div>
              <div class="refill-preview card">
                <span class="refill-preview__label">New expiry date (auto-calculated):</span>
                <span class="refill-preview__date">
                  {{ formatDate(store.computeNewExpiry(conditionForm.date_refilled)) }}
                </span>
                <span class="refill-preview__note">2 years from refill date</span>
              </div>
              <div class="field">
                <label class="field__label">Supplier</label>
                <input v-model="conditionForm.supplier" class="field__input" />
              </div>
              <div class="field">
                <label class="field__label">Warranty</label>
                <div class="warranty-btns">
                  <button
                    class="condition-btn"
                    :class="{ 'condition-btn--active': conditionForm.warranty_years === 1 }"
                    @click="conditionForm.warranty_years = 1"
                  >1 Year</button>
                  <button
                    class="condition-btn"
                    :class="{ 'condition-btn--active': conditionForm.warranty_years === 2 }"
                    @click="conditionForm.warranty_years = 2"
                  >2 Years</button>
                </div>
              </div>
            </template>

            <p v-if="conditionError" class="field__error">{{ conditionError }}</p>

            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="showConditionForm = false">Cancel</button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.logCondition || !conditionForm.condition"
                @click="handleConditionSave"
              >
                {{ store.loading.logCondition ? 'Saving…' : 'Save Condition' }}
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
import { useFireSafetyStore } from '@/stores/firesafety'
import { useElectricalStore } from '@/stores/electrical'
import { supabase } from '@/lib/supabase'
import ToastNotification from '@/components/common/ToastNotification.vue'

const props = defineProps({ id: { type: String, required: true } })

const store    = useFireSafetyStore()
const elStore  = useElectricalStore()

const currentCompliance = computed(() => store.currentCompliance)

const todayStr = new Date().toISOString().split('T')[0]

const toast = ref({ show: false, message: '', type: 'success' })

// ── Computed shortcuts ─────────────────────────────────────────────────────
const building   = computed(() =>
  store.buildings.find((b) => b.building_id === Number(props.id))
)
const compliance = computed(() => store.currentCompliance)
const elGap      = computed(() =>
  Math.max(0,
    (compliance.value?.emergency_lights_needed  ?? 0) -
    (compliance.value?.emergency_lights_on_site ?? 0)
  )
)

// ── FE types config ────────────────────────────────────────────────────────
const feTypes = [
  { key: '10lbs', label: '10 lbs',            onSite: 'fe_10lbs_on_site', needed: 'fe_10lbs_needed' },
  { key: '5lbs',  label: '5 lbs',             onSite: 'fe_5lbs_on_site',  needed: 'fe_5lbs_needed'  },
  { key: 'hcfc',  label: 'HCFC (server rooms)',onSite: 'fe_hcfc_on_site',  needed: 'fe_hcfc_needed'  },
]

function feGap(floor, type) {
  return Math.max(0, (floor[type.needed] ?? 0) - (floor[type.onSite] ?? 0))
}

// ── Binary features config ──────────────────────────────────────────────────
const binaryFeatures = [
  { field: 'fire_hose_cabinet', label: 'Fire Hose Cabinet' },
  { field: 'exit_right',        label: 'EXIT RIGHT sign' },
  { field: 'exit_left',         label: 'EXIT LEFT sign' },
  { field: 'exit_sign',         label: 'EXIT sign (general)' },
  { field: 'sprinkler_system',  label: 'Sprinkler System' },
  { field: 'smoke_detector',    label: 'Smoke Detector' },
]

// ── BFP Ready toggle ───────────────────────────────────────────────────────
async function handleBFPToggle() {
  const newVal = !compliance.value?.bfp_ready
  const ok = await store.setBFPReady(Number(props.id), newVal)
  if (ok) {
    toast.value = {
      show: true,
      message: newVal ? 'Marked as BFP Ready.' : 'Marked as Not Ready.',
      type: 'success',
    }
  }
}

// ── Missing items for banner ───────────────────────────────────────────────
const missingItems = computed(() => {
  if (!compliance.value) return []
  const items = []

  if (!compliance.value.fire_hose_cabinet) items.push('Fire Hose Cabinet')
  if (!compliance.value.exit_right)        items.push('EXIT RIGHT sign')
  if (!compliance.value.exit_left)         items.push('EXIT LEFT sign')
  if (!compliance.value.exit_sign)         items.push('EXIT sign')
  if (!compliance.value.sprinkler_system)  items.push('Sprinkler System')
  if (!compliance.value.smoke_detector)    items.push('Smoke Detector')

  const floors = store.currentFloorCompliances
  const feGap = floors.some(
    (f) =>
      (f.fe_10lbs_on_site ?? 0) < (f.fe_10lbs_needed ?? 0) ||
      (f.fe_5lbs_on_site  ?? 0) < (f.fe_5lbs_needed  ?? 0) ||
      (f.fe_hcfc_on_site  ?? 0) < (f.fe_hcfc_needed  ?? 0)
  )
  const elGap = floors.some(
    (f) => (f.emergency_lights_on_site ?? 0) < (f.emergency_lights_needed ?? 0)
  )
  if (feGap) items.push('fire extinguisher gaps')
  if (elGap) items.push('emergency lights')

  return items
})

// ── Checklist ──────────────────────────────────────────────────────────────
const checklistSaved = ref(false)
let checklistTimer = null

async function handleToggle(field, newValue) {
  const ok = await store.toggleComplianceFeature(Number(props.id), field, newValue)
  if (ok) showChecklistSaved()
}

async function handleCountChange(field, newValue) {
  await store.toggleComplianceFeature(Number(props.id), field, newValue)
  showChecklistSaved()
}

function showChecklistSaved() {
  checklistSaved.value = true
  clearTimeout(checklistTimer)
  checklistTimer = setTimeout(() => { checklistSaved.value = false }, 2000)
}

// ── Floor edit ──────────────────────────────────────────────────────────────
const showFloorEdit  = ref(false)
const editingFloor   = ref(null)
const floorEditForm  = ref({})

function openFloorEdit(floor) {
  editingFloor.value = floor
  floorEditForm.value = {
    fe_10lbs_on_site:         floor.fe_10lbs_on_site         ?? 0,
    fe_10lbs_needed:          floor.fe_10lbs_needed          ?? 0,
    fe_5lbs_on_site:          floor.fe_5lbs_on_site          ?? 0,
    fe_5lbs_needed:           floor.fe_5lbs_needed           ?? 0,
    fe_hcfc_on_site:          floor.fe_hcfc_on_site          ?? 0,
    fe_hcfc_needed:           floor.fe_hcfc_needed           ?? 0,
    emergency_lights_on_site: floor.emergency_lights_on_site ?? 0,
    emergency_lights_needed:  floor.emergency_lights_needed  ?? 0,
  }
  showFloorEdit.value = true
}

async function handleFloorSave() {
  const result = await store.updateFloorCompliance(editingFloor.value.floor_compliance_id, floorEditForm.value)
  if (result) {
    showFloorEdit.value = false
    toast.value = { show: true, message: 'Floor counts updated.', type: 'success' }
  }
}

// ── Emergency lights edit ────────────────────────────────────────────────────
const showEditEL = ref(false)
const elForm = ref({ on_site: 0, needed: 0, notes: '' })

function openELEdit() {
  elForm.value = {
    on_site: compliance.value?.emergency_lights_on_site ?? 0,
    needed:  compliance.value?.emergency_lights_needed  ?? 0,
  }
  showEditEL.value = true
}

async function handleELSave() {
  // Emergency lights are per floor — update all floors for this building
  const results = await Promise.all(
    store.currentFloorCompliances.map((floor) =>
      store.updateFloorCompliance(floor.floor_compliance_id, {
        emergency_lights_on_site: elForm.value.on_site,
        emergency_lights_needed:  elForm.value.needed,
      })
    )
  )
  const allOk = results.every(Boolean)
  if (allOk) {
    showEditEL.value = false
    toast.value = { show: true, message: 'Emergency lights updated.', type: 'success' }
  } else {
    toast.value = { show: true, message: 'Failed to update emergency lights.', type: 'error' }
  }
}

// ── Condition form ──────────────────────────────────────────────────────────
const conditions = ['FULL', 'EMPTY', 'DAMAGED', 'EXPIRED']
const showConditionForm  = ref(false)
const conditionUnit      = ref(null)
const conditionError     = ref('')
const conditionForm      = ref({
  condition:      '',
  date_refilled:  todayStr,
  supplier:       'TRI J&A',
  warranty_years: 2,
})

function openConditionForm(unit) {
  conditionUnit.value    = unit
  conditionError.value   = ''
  conditionForm.value = { condition: '', isRefill: false, date_refilled: todayStr, supplier: 'TRI J&A', warranty_years: 2 }
  showConditionForm.value = true
}

async function handleConditionSave() {
  conditionError.value = ''
  if (!conditionForm.value.condition) { conditionError.value = 'Please select a condition.'; return }

  const result = await store.logCondition(conditionUnit.value.unit_id, {
  condition:      conditionForm.value.condition,
  isRefill:       conditionForm.value.isRefill ?? false,
  date_refilled:  conditionForm.value.date_refilled,
  supplier:       conditionForm.value.supplier,
  warranty_years: conditionForm.value.warranty_years,
})
  if (result) {
    showConditionForm.value = false
    toast.value = { show: true, message: 'Condition updated.', type: 'success' }
  } else {
    conditionError.value = store.error.logCondition ?? 'Failed to save.'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const initializingFloors = ref(false)

const FLOOR_LABELS = [
  'Ground Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor',
  '6th Floor', '7th Floor', '8th Floor', '9th Floor', '10th Floor',
]

async function initializeFloors() {
  if (!currentCompliance.value) return
  initializingFloors.value = true
  try {
    const numFloors = building.value?.number_of_floors ?? 1
    const floors    = FLOOR_LABELS.slice(0, numFloors)

    const rows = floors.map((floorLevel) => ({
      compliance_id:            currentCompliance.value.compliance_id,
      floor_level:              floorLevel,
      fe_10lbs_on_site:         0,
      fe_5lbs_on_site:          0,
      fe_hcfc_on_site:          0,
      fe_10lbs_needed:          0,
      fe_5lbs_needed:           0,
      fe_hcfc_needed:           0,
      emergency_lights_on_site: 0,
      emergency_lights_needed:  0,
    }))

    const { data, error } = await supabase
      .from('fire_floor_compliance')
      .insert(rows)
      .select()

    if (error) throw error

    store.currentFloorCompliances = data ?? []
    toast.value = {
      show: true,
      message: `${numFloors} floor${numFloors > 1 ? 's' : ''} set up. You can now enter counts.`,
      type: 'success',
    }
  } catch (err) {
    toast.value = { show: true, message: 'Failed to set up floors. Please try again.', type: 'error' }
    console.error('[FireSafetyDetail] initializeFloors:', err)
  } finally {
    initializingFloors.value = false
  }
}

function feLabel(size) {
  if (size === 'HCFC') return 'HCFC (for server rooms)'
  return `${size} Fire Extinguisher`
}

function conditionClass(condition) {
  const map = {
    FULL:    'condition--full',
    EMPTY:   'condition--empty',
    DAMAGED: 'condition--damaged',
    EXPIRED: 'condition--expired',
    REFILLED:'condition--full',
  }
  return map[condition] ?? ''
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

onMounted(async () => {
  const bid = Number(props.id)
  await Promise.all([
    store.fetchBuildingCompliance(bid),
    elStore.buildings.length ? Promise.resolve() : store.fetchBuildings(),
  ])
})
</script>

<style scoped>
.fsd-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 16px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header { display: flex; justify-content: space-between; align-items: center; }
.back-btn    { background: none; border: none; font-size: 15px; font-weight: 600; color: var(--blue); cursor: pointer; min-height: 48px; padding: 8px 0; }
.cross-link  { background: none; border: 2px solid var(--border); border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; min-height: 44px; }

/* Header */
.fsd-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.fsd-header__name   { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.fsd-header__dept   { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.fsd-header__badge  { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.fsd-header__updated{ font-size: 12px; color: var(--text-secondary); }

.readiness-badge { font-size: 13px; font-weight: 800; padding: 6px 12px; border-radius: 8px; white-space: nowrap; }
.readiness-badge--ready { background: var(--green-light); color: var(--green); }
.readiness-badge--not   { background: var(--red-light);   color: var(--red); }

/* Card sections */
.card-section { display: flex; flex-direction: column; gap: 12px; }
.section-header { display: flex; justify-content: space-between; align-items: center; }
.section-title  { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; }

/* Floor FE */
.floor-fe-list { display: flex; flex-direction: column; gap: 12px; }
.floor-fe-card { display: flex; flex-direction: column; gap: 10px; }
.floor-fe-card__title { font-size: 15px; font-weight: 800; color: var(--text-primary); }

.fe-type-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.fe-type-row__label { font-size: 14px; font-weight: 600; color: var(--text-primary); flex: 1; }
.fe-type-row__counts { display: flex; gap: 12px; flex-wrap: wrap; }
.fe-count { font-size: 13px; color: var(--text-secondary); }
.fe-gap { font-size: 13px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
.fe-gap--red { color: var(--red); background: var(--red-light); }
.fe-gap--ok  { color: var(--green); }

.edit-floor-btn {
  align-self: flex-start; padding: 8px 14px; border: 1.5px solid var(--border);
  border-radius: 8px; background: var(--bg); font-size: 13px; font-weight: 600;
  color: var(--text-primary); cursor: pointer; min-height: 40px;
}

/* Emergency lights */
.el-card { display: flex; flex-direction: column; gap: 12px; }
.el-row  { display: flex; align-items: center; gap: 0; }
.el-stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px; }
.el-stat__number { font-size: 28px; font-weight: 900; color: var(--text-primary); }
.el-stat__label  { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-align: center; }
.el-stat--red   .el-stat__number { color: var(--red); }
.el-stat--green .el-stat__number { color: var(--green); }
.el-divider { width: 1px; height: 48px; background: var(--border); flex-shrink: 0; }
.el-notes   { font-size: 13px; color: var(--text-secondary); font-style: italic; }

/* Checklist */
.checklist-card  { display: flex; flex-direction: column; gap: 0; padding: 0; overflow: hidden; }
.checklist-item  { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--divider); min-height: 56px; gap: 12px; }
.checklist-item:last-of-type { border-bottom: none; }
.checklist-item__label { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; }

.toggle-btn {
  padding: 8px 18px; border-radius: 8px; border: 2px solid transparent;
  font-size: 13px; font-weight: 800; cursor: pointer; min-height: 40px; min-width: 60px;
  transition: all 0.15s;
}
.toggle-btn--yes { background: var(--green-light); color: var(--green); border-color: var(--green); }
.toggle-btn--no  { background: var(--red-light);   color: var(--red);   border-color: var(--red); }
.toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.stepper { display: flex; align-items: center; gap: 12px; }
.stepper__btn  { width: 40px; height: 40px; border-radius: 8px; border: 2px solid var(--border); background: var(--bg); font-size: 18px; font-weight: 700; cursor: pointer; color: var(--text-primary); }
.stepper__value { font-size: 18px; font-weight: 800; color: var(--text-primary); min-width: 24px; text-align: center; }

.checklist-saved { font-size: 13px; font-weight: 700; color: var(--green); padding: 8px 16px; }

/* Units list */
.units-list { display: flex; flex-direction: column; gap: 10px; }
.unit-card { display: flex; flex-direction: column; gap: 10px; }
.unit-card__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.unit-card__location { display: block; font-size: 15px; font-weight: 700; color: var(--text-primary); }
.unit-card__type     { display: block; font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.condition-badge { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 8px; white-space: nowrap; flex-shrink: 0; }
.condition--full    { background: var(--green-light); color: var(--green); }
.condition--empty   { background: #f3f4f6; color: var(--text-secondary); }
.condition--damaged { background: var(--yellow-light); color: var(--yellow); }
.condition--expired { background: var(--red-light); color: var(--red); }

.unit-card__expiry { display: flex; justify-content: space-between; font-size: 13px; padding: 8px 12px; border-radius: 8px; background: var(--bg); }
.expiry--expired { background: var(--red-light); color: var(--red); font-weight: 700; }
.expiry--soon    { background: var(--yellow-light); color: var(--yellow); font-weight: 700; }
.expiry--ok      { color: var(--text-secondary); }
.expiry-days     { font-weight: 700; }

.log-action-btn {
  align-self: flex-start; padding: 10px 18px; border: 2px solid var(--blue);
  border-radius: 8px; background: var(--blue-light); color: var(--blue);
  font-size: 14px; font-weight: 700; cursor: pointer; min-height: 44px;
}

/* Condition buttons */
.condition-btns, .warranty-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.condition-btn {
  padding: 10px 16px; border: 2px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text-primary); font-size: 14px;
  font-weight: 600; cursor: pointer; min-height: 48px;
}
.condition-btn--active { border-color: var(--blue); background: var(--blue-light); color: var(--blue); }

/* Refill preview */
.refill-preview {
  background: var(--green-light) !important;
  display: flex; flex-direction: column; gap: 2px;
  padding: 14px 16px;
}
.refill-preview__label { font-size: 12px; font-weight: 700; color: var(--green); text-transform: uppercase; letter-spacing: 0.05em; }
.refill-preview__date  { font-size: 18px; font-weight: 800; color: var(--green); }
.refill-preview__note  { font-size: 12px; color: var(--green); }

/* Field group (floor edit) */
.field-group { display: flex; flex-direction: column; gap: 8px; }
.field-group__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field-group__row   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 12px; }
.empty-note { font-size: 14px; color: var(--text-secondary); font-style: italic; padding: 8px 0; }

/* Button sizes */
.btn-ghost { display: inline-flex; align-items: center; justify-content: center; background: none; border: 2px solid var(--border); border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; color: var(--text-primary); }
.btn-sm { padding: 8px 14px; min-height: 40px; }

/* Transitions */
.dialog-enter-active, .dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: scale(0.96); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Dialog styles (shared) */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9000; padding: 24px; }
.dialog { background: var(--surface); border-radius: 18px; padding: 28px 24px; width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 16px; max-height: 90vh; overflow-y: auto; }
.dialog__title { font-size: 18px; font-weight: 800; margin: 0; color: var(--text-primary); }
.dialog__body  { font-size: 15px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.dialog__actions { display: flex; gap: 10px; justify-content: flex-end; }
.dialog__btn { padding: 12px 20px; border-radius: 10px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; min-height: 48px; }
.dialog__btn--cancel  { background: var(--bg); color: var(--text-secondary); border: 2px solid var(--border); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn:disabled { opacity: 0.45; cursor: not-allowed; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__input { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; min-height: 48px; width: 100%; box-sizing: border-box; }
.field__textarea { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; width: 100%; box-sizing: border-box; resize: vertical; }
.field__error { font-size: 13px; color: var(--red); font-weight: 600; }

/* Not ready banner */
.not-ready-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: var(--red-light);
  border-radius: 10px;
  border-left: 4px solid var(--red);
}
.not-ready-banner__icon  { font-size: 20px; color: var(--red); flex-shrink: 0; margin-top: 2px; }
.not-ready-banner__title { font-size: 14px; font-weight: 800; color: var(--red); margin: 0; }
.not-ready-banner__details { font-size: 13px; color: var(--red); margin: 2px 0 0; line-height: 1.5; }

/* Readiness badge as button */
.readiness-badge { cursor: pointer; border: none; font-size: 12px; }
.readiness-badge:disabled { opacity: 0.6; cursor: not-allowed; }

.empty-note-action {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--yellow-light);
  border-radius: 10px;
}
.empty-note-action__text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}
</style>
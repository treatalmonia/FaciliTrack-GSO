<template>
  <form class="request-form" @submit.prevent="handleSubmit">

    <!-- Building -->
    <div class="field">
      <label class="field__label">Building <span class="field__req">*</span></label>
      <select v-model="form.building_id" class="field__select" required @change="onBuildingChange">
        <option value="" disabled>Select a building</option>
        <option
          v-for="b in store.buildings"
          :key="b.building_id"
          :value="b.building_id"
        >{{ b.building_name }}</option>
      </select>
    </div>

    <!-- Floor -->
    <div class="field">
      <label class="field__label">Floor <span class="field__req">*</span></label>
      <select v-model="form.floor_level" class="field__select" required :disabled="!form.building_id" @change="onFloorChange">
        <option value="" disabled>Select a floor</option>
        <option v-for="f in availableFloors" :key="f" :value="f">{{ f }}</option>
      </select>
    </div>

    <!-- Room -->
    <div class="field">
      <label class="field__label">Room <span class="field__req">*</span></label>
      <select v-model="form.room_id" class="field__select" required :disabled="!form.floor_level">
        <option value="" disabled>Select a room</option>
        <option
          v-for="r in availableRooms"
          :key="r.room_id"
          :value="r.room_id"
        >{{ r.room_number }} — {{ r.room_name }}</option>
      </select>
    </div>

    <!-- Item Type -->
    <div class="field">
      <label class="field__label">Item Type <span class="field__req">*</span></label>
      <select v-model="form.item_id" class="field__select" required :disabled="!form.room_id">
        <option value="" disabled>Select an item</option>
        <optgroup v-for="group in itemGroups" :key="group.label" :label="group.label">
          <option
            v-for="item in group.items"
            :key="item.item_id"
            :value="item.item_id"
          >{{ item.item_type }}</option>
        </optgroup>
      </select>
      <p class="field__hint">
        Item not listed?
        <button type="button" class="field__link" :disabled="!form.room_id" @click="showAddItemModal = true">
          Add it first
        </button>
      </p>
    </div>

    <AddItemModal
      v-if="showAddItemModal"
      :room-id="form.room_id"
      @close="showAddItemModal = false"
      @saved="onItemAdded"
    />

    <!-- Problem -->
    <div class="field">
      <label class="field__label">Problem <span class="field__req">*</span></label>
      <select v-model="form.problem_description" class="field__select" required>
        <option value="" disabled>What is the problem?</option>
        <option v-for="p in problemOptions" :key="p" :value="p">{{ p }}</option>
      </select>
      <input
        v-if="form.problem_description === 'Other'"
        v-model="form.custom_problem"
        class="field__input"
        placeholder="Describe the problem..."
        style="margin-top: 8px"
      />
    </div>

    <!-- Quantity -->
    <div class="field">
      <label class="field__label">How many units have this problem?</label>
      <input
        v-model.number="form.quantity_affected"
        type="number"
        class="field__input"
        min="1"
        placeholder="1"
      />
    </div>

    <!-- Date Reported -->
    <div class="field">
      <label class="field__label">When was this reported?</label>
      <input
        v-model="form.date_reported"
        type="date"
        class="field__input"
        :max="today"
      />
      <p v-if="dateError" class="field__error">{{ dateError }}</p>
    </div>

    <!-- Notes -->
    <div class="field">
      <label class="field__label">Additional details (optional)</label>
      <textarea
        v-model="form.notes"
        class="field__textarea"
        rows="3"
        placeholder="e.g., located near the window, already happened twice"
      />
    </div>

    <!-- Submit -->
    <button type="submit" class="btn btn--submit" :disabled="loading">
      {{ loading ? 'Saving…' : submitLabel }}
    </button>
  </form>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useElectricalStore } from '@/stores/electrical'
import AddItemModal from '@/components/electrical/AddItemModal.vue'

const props = defineProps({
  initialData:  { type: Object,  default: null },   // for edit mode
  prefillRoom:  { type: Object,  default: null },   // { building_id, floor_level, room_id }
  submitLabel:  { type: String,  default: 'Save Request' },
  loading:      { type: Boolean, default: false },
})

const emit = defineEmits(['submit'])
const showAddItemModal = ref(false)
const isPrefilling     = ref(false)

const store = useElectricalStore()

const today = new Date().toISOString().split('T')[0]

const form = ref({
  building_id:         '',
  floor_level:         '',
  room_id:             '',
  item_id:             '',
  problem_description: '',
  custom_problem:      '',
  quantity_affected:   1,
  date_reported:       today,
  notes:               '',
})

const problemOptions = [
  'Busted', 'Defective', 'Lacking', 'Other',
]

const FLOOR_LABELS = [
  'Ground Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor',
  '6th Floor', '7th Floor', '8th Floor', '9th Floor', '10th Floor',
]

// ── Derived lists ─────────────────────────────────────────────────────────────
const availableFloors = computed(() => {
  const building = store.buildings.find((b) => b.building_id === form.value.building_id)
  if (!building) return []
  return FLOOR_LABELS.slice(0, building.number_of_floors)
})

const availableRooms = computed(() =>
  store.rooms.filter(
    (r) =>
      r.building_id === form.value.building_id &&
      r.floor_level === form.value.floor_level
  )
)

const selectedRoom = computed(() =>
  store.rooms.find((r) => r.room_id === form.value.room_id)
)

const itemGroups = computed(() => {
  const items = selectedRoom.value?.equipment_item ?? []
  const groupMap = {}
  for (const item of items) {
    if (!groupMap[item.category]) groupMap[item.category] = []
    groupMap[item.category].push(item)
  }
  const labelMap = {
    Lighting:  'LIGHTING',
    AC:        'AC UNITS',
    Outlet:    'OUTLETS',
    Equipment: 'EQUIPMENT',
  }
  return Object.entries(groupMap).map(([key, items]) => ({
    label: labelMap[key] ?? key,
    items,
  }))
})

const dateError = computed(() => {
  if (form.value.date_reported > today) return 'Date reported cannot be in the future.'
  return ''
})

// ── Watchers / cascade resets ─────────────────────────────────────────────────
async function onBuildingChange() {
  form.value.floor_level = ''
  form.value.room_id     = ''
  form.value.item_id     = ''
  await store.fetchRoomsByBuilding(form.value.building_id)
  
}

function onFloorChange() {
  if (isPrefilling.value) return
  form.value.room_id = ''
  form.value.item_id = ''
}

watch(() => form.value.room_id, () => {
  form.value.item_id = ''
})

// ── Prefill ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  

  await store.fetchBuildings()

  if (props.prefillRoom) {
    isPrefilling.value     = true
    form.value.building_id = props.prefillRoom.building_id
    await store.fetchRoomsByBuilding(props.prefillRoom.building_id)
    form.value.floor_level = props.prefillRoom.floor_level
    form.value.room_id     = props.prefillRoom.room_id
    isPrefilling.value     = false
  }

  if (props.initialData) {
    Object.assign(form.value, {
      building_id:         props.initialData.room?.building_id ?? '',
      floor_level:         props.initialData.room?.floor_level  ?? '',
      room_id:             props.initialData.room_id,
      item_id:             props.initialData.item_id,
      problem_description: props.initialData.problem_description,
      quantity_affected:   props.initialData.quantity_affected ?? 1,
      date_reported:       props.initialData.date_reported,
      notes:               props.initialData.notes ?? '',
    })
    if (form.value.building_id) {
      await store.fetchRoomsByBuilding(form.value.building_id)
    }
  }
})

// ── Submit ────────────────────────────────────────────────────────────────────
async function onItemAdded(newItem) {
  showAddItemModal.value = false
  await store.fetchRoomsByBuilding(form.value.building_id)
  form.value.item_id = newItem.item_id
}

function handleSubmit() {
  if (dateError.value) return

  const payload = {
    ...form.value,
    problem_description:
      form.value.problem_description === 'Other'
        ? form.value.custom_problem
        : form.value.problem_description,
  }

  emit('submit', payload)
}


</script>

<style scoped>
.request-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field { display: flex; flex-direction: column; gap: 6px; }

.field__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.field__req { color: var(--red); }

.field__select,
.field__input,
.field__textarea {
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  color: var(--text-primary);
  background: var(--bg);
  min-height: 44px;
  width: 100%;
  box-sizing: border-box;
  appearance: auto;
}
.field__select:focus,
.field__input:focus,
.field__textarea:focus {
  outline: none;
  border-color: var(--blue);
}
.field__select:disabled { opacity: 0.5; }

.field__textarea { resize: vertical; min-height: 80px; line-height: 1.6; }

.field__hint { font-size: 13px; color: var(--text-secondary); margin: 0; }

.field__link {
  background: none;
  border: none;
  color: var(--blue);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  text-decoration: underline;
}

.field__error { font-size: 13px; color: var(--red); margin: 0; }

.btn--submit {
  padding: 14px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  min-height: 52px;
}
.btn--submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal">
        <h2 class="modal__title">Add New Item</h2>
        <p class="modal__subtitle">This item will be added to the selected room.</p>

        <div class="field">
          <label class="field__label">Item Name <span class="field__req">*</span></label>
          <input v-model="form.item_type" class="field__input" placeholder="e.g., Fluorescent Lamp" />
        </div>

        <div class="field">
          <label class="field__label">Category <span class="field__req">*</span></label>
          <select v-model="form.category" class="field__select">
            <option value="" disabled>Select a category</option>
            <option value="Lighting">Lighting Fixtures</option>
            <option value="Outlet">Convenience Outlet</option>
            <option value="AC">Air Conditioning Unit</option>
            <option value="Equipment">Machineries and Equipment</option>
          </select>
        </div>

        <div class="field">
          <label class="field__label">Wattage per unit (optional)</label>
          <input v-model.number="form.wattage_per_unit" type="number" class="field__input" placeholder="e.g., 18" min="0" />
        </div>

        <div class="field">
          <label class="field__label">How many units exist in this room? <span class="field__req">*</span></label>
          <input v-model.number="form.total_count" type="number" class="field__input" placeholder="e.g., 4" min="1" />
        </div>

        <p v-if="error" class="field__error">{{ error }}</p>

        <div class="modal__actions">
          <button class="btn btn--cancel" @click="$emit('close')">Cancel</button>
          <button class="btn btn--save" :disabled="saving" @click="handleSave">
            {{ saving ? 'Saving…' : 'Add Item' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { useElectricalStore } from '@/stores/electrical'

const props = defineProps({
  roomId:         { type: Number, required: true },
  presetCategory: { type: String, default: '' },
})

const emit = defineEmits(['close', 'saved'])

const store = useElectricalStore()

const saving = ref(false)
const error  = ref('')

const form = ref({
  item_type:        '',
  category:         props.presetCategory,
  wattage_per_unit: null,
  total_count:      1,
})

async function handleSave() {
  error.value = ''
  if (!form.value.item_type.trim()) { error.value = 'Item name is required.'; return }
  if (!form.value.category)         { error.value = 'Category is required.';  return }
  if (!form.value.total_count || form.value.total_count < 1) { error.value = 'Total units must be at least 1.'; return }

  saving.value = true
  const result = await store.addEquipmentItem({
    room_id:          props.roomId,
    item_type:        form.value.item_type.trim(),
    category:         form.value.category,
    wattage_per_unit: form.value.wattage_per_unit || null,
    total_count:      form.value.total_count,
    busted_count:     0,
    working_count:    form.value.total_count,
  })
  saving.value = false

  if (result) {
    emit('saved', result)
  } else {
    error.value = store.error.addEquipmentItem ?? 'Failed to save. Please try again.'
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 24px;
}
.modal {
  background: var(--surface); border-radius: 16px; padding: 28px 24px;
  width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px;
}
.modal__title    { font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0; }
.modal__subtitle { font-size: 13px; color: var(--text-secondary); margin: 0; }
.modal__actions  { display: flex; gap: 12px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__req   { color: var(--red); }
.field__input, .field__select {
  padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px;
  font-size: 15px; color: var(--text-primary); background: var(--bg);
  min-height: 44px; width: 100%; box-sizing: border-box;
}
.field__error { font-size: 13px; color: var(--red); margin: 0; }

.btn { flex: 1; padding: 14px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; min-height: 52px; }
.btn--cancel { background: var(--bg); color: var(--text-primary); border: 2px solid var(--border); }
.btn--save   { background: var(--blue); color: #fff; }
.btn--save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
<template>
  <div class="equipment-section">
    <!-- Category blocks -->
    <div v-for="cat in categories" :key="cat.key" class="eq-category">
      <div class="eq-category__header" @click="cat.expanded = !cat.expanded">
        <span class="eq-category__title">{{ cat.label }}</span>
        <span class="eq-category__toggle">{{ cat.expanded ? '▲' : '▼' }}</span>
      </div>

      <div v-if="cat.expanded" class="eq-category__body">
        <div v-if="cat.items.length === 0" class="eq-category__empty">
          <span>No items recorded.</span>
          <button
            v-if="canEdit"
            class="eq-category__add-btn"
            @click="$emit('add-item', cat.key)"
          >
            + Add Item
          </button>
        </div>

        <div
          v-for="item in cat.items"
          :key="item.item_id"
          class="eq-item"
        >
          <div class="eq-item__row">
            <span class="eq-item__type">{{ item.item_type }}</span>
            <div class="eq-item__counts">
              <span class="eq-item__working">{{ item.working_count }} working</span>
              <span v-if="item.busted_count > 0" class="eq-item__busted">
                {{ item.busted_count }} busted
              </span>
            </div>
          </div>

          <!-- Wattage — shown only in expanded/details view -->
          <div v-if="showWattage && item.wattage_per_unit" class="eq-item__wattage">
            {{ item.wattage_per_unit }}W per unit
            · Total: {{ item.total_count * item.wattage_per_unit }}W
          </div>

          <!-- Edit count button -->
          <button
            v-if="canEdit"
            class="eq-item__edit-btn"
            @click="$emit('edit-item', item)"
          >
            ✏ Edit Count
          </button>
        </div>
      </div>
    </div>

    <!-- Load details toggle -->
    <button
      v-if="hasWattageData"
      class="load-toggle"
      @click="showWattage = !showWattage"
    >
      {{ showWattage ? 'Hide Load Details' : 'View Load Details' }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  equipment: { type: Array,   default: () => [] },
  canEdit:   { type: Boolean, default: true },
})

defineEmits(['edit-item', 'add-item'])

const showWattage = ref(false)

const categories = ref([
  { key: 'Lighting',   label: 'Lighting Fixtures',         expanded: true,  items: [] },
  { key: 'Outlet',     label: 'Convenience Outlets',        expanded: true,  items: [] },
  { key: 'AC',         label: 'Air Conditioning Units',     expanded: true,  items: [] },
  { key: 'Equipment',  label: 'Machineries & Equipment',    expanded: false, items: [] },
])

/* Comment for now */
// // Fill categories from equipment prop
// computed(() => {
//   categories.value.forEach((cat) => { cat.items = [] })
//   for (const item of props.equipment) {
//     const cat = categories.value.find((c) => c.key === item.category)
//     if (cat) cat.items.push(item)
//   }
// })

const hasWattageData = computed(() =>
  props.equipment.some((e) => e.wattage_per_unit)
)

// Call the categorize logic immediately and whenever equipment changes
import { watchEffect } from 'vue'
watchEffect(() => {
  categories.value.forEach((cat) => { cat.items = [] })
  for (const item of props.equipment) {
    const cat = categories.value.find((c) => c.key === item.category)
    if (cat) cat.items.push(item)
  }
})
</script>

<style scoped>
.equipment-section { display: flex; flex-direction: column; gap: 12px; }

.eq-category {
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.eq-category__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  min-height: 48px;
  user-select: none;
}

.eq-category__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.eq-category__toggle {
  font-size: 12px;
  color: var(--text-secondary);
}

.eq-category__body {
  padding: 0 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.eq-category__empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
}

.eq-category__add-btn {
  font-style: normal;
  padding: 6px 14px;
  border: 1.5px solid var(--blue);
  border-radius: 6px;
  background: var(--bg);
  color: var(--blue);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  min-height: 36px;
}

.eq-item { display: flex; flex-direction: column; gap: 4px; }

.eq-item__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.eq-item__type {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.eq-item__counts { display: flex; gap: 10px; align-items: center; }

.eq-item__working {
  font-size: 14px;
  color: var(--green-dark, #1a7f37);
  font-weight: 600;
}

.eq-item__busted {
  font-size: 14px;
  font-weight: 700;
  color: var(--red);
  background: #fee2e2;
  padding: 2px 10px;
  border-radius: 20px;
}

.eq-item__wattage {
  font-size: 13px;
  color: var(--text-secondary);
}

.eq-item__edit-btn {
  align-self: flex-start;
  padding: 6px 14px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  min-height: 36px;
}

.load-toggle {
  padding: 12px 18px;
  border: 2px solid var(--blue);
  border-radius: 10px;
  background: transparent;
  color: var(--blue);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  text-align: center;
}
</style>

<template>
  <div class="request-card">
    <!-- Header row -->
    <div class="request-card__header">
      <div>
        <span class="request-card__item">
          {{ request.equipment_item?.item_type ?? 'Unknown Item' }}
        </span>
        <span class="request-card__problem">{{ request.problem_description }}</span>
      </div>
      <span class="request-card__days" :class="daysClass">
        {{ daysOpen }} {{ daysOpen === 1 ? 'day' : 'days' }} open
      </span>
    </div>

    <!-- Meta row -->
    <div class="request-card__meta">
      <span>Reported: {{ formatDate(request.date_reported) }}</span>
      <span v-if="request.quantity_affected > 1">
        · {{ request.quantity_affected }} units
      </span>
    </div>

    <p v-if="request.notes" class="request-card__notes">{{ request.notes }}</p>

    <!-- Actions -->
    <div class="request-card__actions">
      <button class="btn btn--resolve" @click="$emit('resolve', request)">
        ✓ Mark as Fixed
      </button>
      <button class="btn btn--edit" @click="$emit('edit', request)">
        ✏ Edit
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  request: { type: Object, required: true },
})
defineEmits(['resolve', 'edit'])

const daysOpen = computed(() => {
  const reported = new Date(props.request.date_reported)
  const today    = new Date()
  return Math.floor((today - reported) / (1000 * 60 * 60 * 24))
})

const daysClass = computed(() => {
  if (daysOpen.value >= 14) return 'request-card__days--red'
  if (daysOpen.value >= 7)  return 'request-card__days--yellow'
  return 'request-card__days--normal'
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}
</script>

<style scoped>
.request-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-left: 4px solid var(--yellow);
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}

.request-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.request-card__item {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.request-card__problem {
  display: block;
  font-size: 14px;
  color: var(--red);
  font-weight: 600;
  margin-top: 2px;
}

.request-card__days {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 20px;
  background: #f3f4f6;
}
.request-card__days--red    { background: #fee2e2; color: #b91c1c; }
.request-card__days--yellow { background: #fef3c7; color: #92400e; }
.request-card__days--normal { background: #f3f4f6; color: var(--text-secondary); }

.request-card__meta {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.request-card__notes {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  font-style: italic;
  line-height: 1.5;
}

.request-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  flex: 1;
}
.btn--resolve { background: var(--green); color: #fff; }
.btn--edit    { background: var(--bg); color: var(--text-primary); border: 1.5px solid var(--border); }
</style>

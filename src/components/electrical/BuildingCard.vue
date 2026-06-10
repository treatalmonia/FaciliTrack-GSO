<template>
  <button class="building-card" @click="$emit('click')">
    <div class="building-card__left">
      <span class="building-card__name">{{ building.building_name }}</span>
      <span v-if="building.college_or_department" class="building-card__dept">
        {{ building.college_or_department }}
      </span>
    </div>

    <div class="building-card__right">
      <span class="building-card__badge" :class="badgeClass">
        {{ openCount }}
      </span>
      <span class="building-card__badge-label">
        {{ openCount === 1 ? 'pending' : 'pending' }}
      </span>
      <span class="building-card__arrow">›</span>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  building:  { type: Object,  required: true },
  openCount: { type: Number,  default: 0 },
})

defineEmits(['click'])

const badgeClass = computed(() => {
  if (props.openCount === 0)   return 'building-card__badge--green'
  if (props.openCount <= 5)    return 'building-card__badge--yellow'
  return 'building-card__badge--red'
})
</script>

<style scoped>
.building-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 18px;
  background: var(--surface);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  min-height: 72px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  transition: box-shadow 0.15s, transform 0.1s;
}
.building-card:active { transform: scale(0.985); }

.building-card__left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.building-card__name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.building-card__dept {
  font-size: 13px;
  color: var(--text-secondary);
}

.building-card__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 12px;
}

.building-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 800;
  padding: 0 8px;
}
.building-card__badge--green  { background: #d4f0df; color: #1a7f37; }
.building-card__badge--yellow { background: #fef3c7; color: #92400e; }
.building-card__badge--red    { background: #fee2e2; color: #b91c1c; }

.building-card__badge-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.building-card__arrow {
  font-size: 20px;
  color: var(--text-secondary);
  margin-left: 4px;
}
</style>

<template>
  <div class="floor-tabs" role="tablist">
    <button
      v-for="floor in floors"
      :key="floor"
      class="floor-tab"
      :class="{ 'floor-tab--active': modelValue === floor }"
      role="tab"
      :aria-selected="modelValue === floor"
      @click="$emit('update:modelValue', floor)"
    >
      {{ floor }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  floors:     { type: Array,  required: true },   // e.g. ['Ground Floor', '2nd Floor']
  modelValue: { type: String, required: true },   // currently active floor
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.floor-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 0 4px;
  scrollbar-width: none;
}
.floor-tabs::-webkit-scrollbar { display: none; }

.floor-tab {
  flex-shrink: 0;
  padding: 10px 18px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  white-space: nowrap;
  transition: all 0.15s;
}

.floor-tab--active {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}
</style>

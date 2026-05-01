<template>
  <div class="empty-state">
    <div class="empty-state__icon">{{ icon }}</div>
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="subtitle" class="empty-state__subtitle">{{ subtitle }}</p>
    <button
      v-if="actionLabel"
      class="btn btn--primary"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  icon:        { type: String, required: true },
  title:       { type: String, required: true },
  subtitle:    { type: String, default: '' },
  actionLabel: { type: String, default: '' },
})
defineEmits(['action'])
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;
}

.empty-state__icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 4px;
  opacity: 0.5;
}

.empty-state__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.empty-state__subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 280px;
  margin: 0;
}

.btn {
  margin-top: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
}
.btn--primary { background: var(--blue); color: #fff; }
</style>

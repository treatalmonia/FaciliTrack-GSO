<template>
  <div class="resolved-card">
    <div class="resolved-card__row">
      <span class="resolved-card__item">
        {{ request.equipment_item?.item_type ?? 'Unknown Item' }}
      </span>
      <span class="resolved-card__badge">Fixed</span>
    </div>
    <div class="resolved-card__meta">
      <span>Reported: {{ formatDate(request.date_reported) }}</span>
      <span v-if="request.date_resolved">
        · Resolved: {{ formatDate(request.date_resolved) }}
      </span>
    </div>
    <p v-if="request.action_taken" class="resolved-card__action">
      Action taken: {{ request.action_taken }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  request: { type: Object, required: true },
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}
</script>

<style scoped>
.resolved-card {
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--surface);
  border-left: 4px solid var(--green);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resolved-card__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resolved-card__item {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.resolved-card__badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  background: #d4f0df;
  color: #1a7f37;
}

.resolved-card__meta {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.resolved-card__action {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  font-style: italic;
}
</style>

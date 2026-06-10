<template>
  <button class="room-card" @click="$emit('click')">
    <div class="room-card__left">
      <span class="room-card__number">{{ room.room_name }}</span>
      <span class="room-card__name">{{ room.room_number }}</span>
    </div>
    <div class="room-card__right" @click.stop="$emit('edit-room')">
      <span class="room-card__edit">✏</span>
      <span v-if="openCount > 0" class="room-card__dot room-card__dot--open">
        {{ openCount }} pending
      </span>
      <span v-else-if="bustedCount > 0" class="room-card__dot room-card__dot--busted">
        {{ bustedCount }} busted
      </span>
      <span v-else class="room-card__dot room-card__dot--ok">No issues</span>
      <span class="room-card__arrow">›</span>
    </div>
  </button>
</template>

<script setup>
defineProps({
  room:        { type: Object, required: true },
  openCount:   { type: Number, default: 0 },
  bustedCount: { type: Number, default: 0 },
})
defineEmits(['click', 'edit-room'])
</script>

<style scoped>
.room-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 18px;
  background: var(--surface);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  min-height: 64px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: transform 0.1s;
}
.room-card:active { transform: scale(0.985); }

.room-card__left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.room-card__number {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.room-card__name {
  font-size: 13px;
  color: var(--text-secondary);
}

.room-card__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

.room-card__dot {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
}
.room-card__dot--open { background: #fef3c7; color: #92400e; }
.room-card__dot--ok     { background: #d4f0df; color: #1a7f37; }
.room-card__dot--busted { background: var(--red-light); color: var(--red); }

.room-card__edit {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 4px 6px;
}
.room-card__arrow {
  font-size: 20px;
  color: var(--text-secondary);
}
</style>

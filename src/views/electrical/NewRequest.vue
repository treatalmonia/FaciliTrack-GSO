<template>
  <div class="new-request-page">
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">‹ Back</button>
    </div>

    <h1 class="page-title">Log a Problem</h1>
    <p class="page-subtitle">Fill in the details below and tap Save Request.</p>

    <RequestForm
      v-if="!editRequestId || initialData"
      :prefill-room="prefillRoom"
      :initial-data="initialData"
      :loading="store.loading.addRequest"
      :submit-label="editRequestId ? 'Save Changes' : 'Save Request'"
      @submit="handleSubmit"
      @add-item="goToAddItem"
    />
<div v-else class="loading-edit">Loading request...</div>

    <!-- Post-save options -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showPostSave" class="dialog-overlay">
          <div class="dialog">
            <div class="dialog__icon">✓</div>
            <h2 class="dialog__title">Request saved.</h2>
            <p class="dialog__body">{{ savedConfirmation }}</p>
            <div class="dialog__stack">
              <button class="dialog__btn dialog__btn--primary" @click="addAnother">
                Add Another Request
              </button>
              <button class="dialog__btn dialog__btn--secondary" @click="goToRoom">
                Go to Room
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useElectricalStore } from '@/stores/electrical'
import RequestForm from '@/components/electrical/RequestForm.vue'

const route  = useRoute()
const router = useRouter()
const store  = useElectricalStore()

// Pre-fill from query params (when opened from Room Detail)
const prefillRoom = computed(() => {
  if (route.query.room_id) {
    return {
      building_id: Number(route.query.building_id),
      floor_level: route.query.floor_level,
      room_id:     Number(route.query.room_id),
    }
  }
  return null
})

const editRequestId = computed(() =>
  route.query.edit ? Number(route.query.edit) : null
)

const initialData = ref(null)

onMounted(async () => {
  if (editRequestId.value) {
    await store.fetchBuildings()
    const roomId = Number(route.query.room_id)
    await store.fetchRoomsByBuilding(Number(route.query.building_id))
    await store.fetchRequestsByRoom(roomId)
    const req = store.openRequests.find(r => r.request_id === editRequestId.value)
    console.log('FOUND REQ:', JSON.stringify(req, null, 2))
    if (req) initialData.value = req
  }
})

const showPostSave      = ref(false)
const savedConfirmation = ref('')
const lastSavedRoomId   = ref(null)
const lastSavedBuildingId = ref(null)

async function handleSubmit(formData) {
  let result

  if (editRequestId.value) {
    result = await store.updateRequest({
      request_id:          editRequestId.value,
      item_id:             formData.item_id,
      room_id:             formData.room_id,
      problem_description: formData.problem_description,
      quantity_affected:   formData.quantity_affected,
      date_reported:       formData.date_reported,
      notes:               formData.notes || undefined,
    })
  } else {
    result = await store.addRequest({
      item_id:             formData.item_id,
      room_id:             formData.room_id,
      problem_description: formData.problem_description,
      quantity_affected:   formData.quantity_affected,
      date_reported:       formData.date_reported,
      notes:               formData.notes || undefined,
    })
  }

  if (result) {
    const building = store.buildings.find((b) => b.building_id === formData.building_id)
    const room     = store.rooms.find((r) => r.room_id === formData.room_id)
    savedConfirmation.value   = `${building?.building_name ?? ''} — ${room?.room_number ?? ''} ${room?.room_name ?? ''}`
    lastSavedRoomId.value     = formData.room_id
    lastSavedBuildingId.value = formData.building_id
    showPostSave.value        = true
  } else {
    alert(store.error.addRequest ?? store.error.updateRequest ?? 'Failed to save request. Please try again.')
  }
}

function goToAddItem() {
  router.push({ name: 'NewRequest' }) // temporary — replace with your actual Add Item route name
}

function addAnother() {
  showPostSave.value = false
  // The form resets itself since we just leave the page and come back
  router.replace({ name: 'NewRequest', query: route.query })
}

function goToRoom() {
  showPostSave.value = false
  if (lastSavedRoomId.value) {
    router.push({
      name: 'RoomDetail',
      params: {
        id:     lastSavedBuildingId.value,
        roomId: lastSavedRoomId.value,
      },
    })
  } else {
    router.push({ name: 'ElectricalDashboard' })
  }
}
</script>

<style scoped>
.new-request-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 16px 16px 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header { display: flex; }
.back-btn { background: none; border: none; font-size: 16px; font-weight: 600; color: var(--blue); cursor: pointer; padding: 8px 0; min-height: 44px; }

.page-title    { font-size: 24px; font-weight: 800; color: var(--text-primary); margin: 0; }
.page-subtitle { font-size: 14px; color: var(--text-secondary); margin: 0; }
.loading-edit { font-size: 15px; color: var(--text-secondary); padding: 24px 0; text-align: center; }

/* Post-save dialog */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9000; padding: 24px; }
.dialog { background: var(--surface); border-radius: 16px; padding: 32px 24px; width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 16px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.dialog__icon { font-size: 48px; line-height: 1; }
.dialog__title { font-size: 20px; font-weight: 800; color: var(--text-primary); margin: 0; }
.dialog__body { font-size: 14px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.dialog__stack { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.dialog__btn { padding: 14px; border-radius: 10px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; min-height: 52px; }
.dialog__btn--primary { background: var(--blue); color: #fff; }
.dialog__btn--secondary { background: var(--bg); color: var(--text-primary); border: 2px solid var(--border); }

.dialog-enter-active, .dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: scale(0.96); }
</style>

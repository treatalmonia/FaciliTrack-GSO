<template>
  <div class="room-detail">

    <!-- Back -->
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">‹ Back</button>
    </div>

    <div v-if="store.loading.currentRoom" class="skeleton-header" />

    <template v-else-if="store.currentRoom">
      <!-- Section A: Room Identity -->
      <header class="room-header">
        <div>
          <h1 class="room-header__number">{{ store.currentRoom.room_number }}</h1>
          <p class="room-header__name">{{ store.currentRoom.room_name }}</p>
          <p class="room-header__meta">
            {{ store.currentRoom.floor_level }} ·
            {{ building?.building_name ?? '—' }}
            <span v-if="store.currentRoom.floor_area_sqm">
              · {{ store.currentRoom.floor_area_sqm }} sqm
            </span>
          </p>
        </div>
      </header>

      <!-- Section B: Equipment Inventory -->
      <section class="card-section">
        <h2 class="section-title">Items in this room</h2>
        <EquipmentSection
          :equipment="store.currentRoom.equipment_item ?? []"
          @edit-item="openEditEquipment"
          @add-item="openAddItem"
        />

        <AddItemModal
          v-if="showAddItemModal"
          :room-id="Number(props.roomId)"
          :preset-category="addItemCategory"
          @close="showAddItemModal = false"
          @saved="onItemAdded"
        />
      </section>

      <!-- Section C: Open Requests -->
      <section class="card-section">
        <div class="section-header">
          <h2 class="section-title">
            Not yet fixed
            <span v-if="store.openRequests.length" class="count-badge count-badge--red">
              {{ store.openRequests.length }}
            </span>
          </h2>
          <button class="btn btn--new" @click="goToNewRequest">
            + Log Problem
          </button>
        </div>

        <div v-if="store.loading.requests" class="skeleton-list">
          <div v-for="n in 2" :key="n" class="skeleton-card" />
        </div>

        <EmptyState
          v-else-if="!store.openRequests.length"
          icon="✅"
          title="No open requests for this room."
          subtitle="No problems have been reported here — or everything has been fixed."
          action-label="Log a Problem"
          @action="goToNewRequest"
        />

        <div v-else class="requests-list">
          <RequestCard
            v-for="req in store.openRequests"
            :key="req.request_id"
            :request="req"
            @resolve="openResolveDialog"
            @edit="openEditRequest"
          />
        </div>
      </section>

      <!-- Section D: Resolved History -->
      <section class="card-section">
        <button class="history-toggle" @click="showHistory = !showHistory">
          <span>Resolved History</span>
          <span>{{ showHistory ? '▲' : '▼' }}</span>
        </button>

        <template v-if="showHistory">
          <div v-if="!store.resolvedRequests.length" class="history-empty">
            No resolved requests yet.
          </div>
          <div v-else class="requests-list">
            <ResolvedRequestCard
              v-for="req in displayedResolved"
              :key="req.request_id"
              :request="req"
            />
            <button
              v-if="!showAllResolved && store.resolvedRequests.length > 3"
              class="see-all-btn"
              @click="showAllResolved = true"
            >
              See all {{ store.resolvedRequests.length }} resolved requests
            </button>
          </div>
        </template>
      </section>
    </template>

    <!-- ── Resolve Dialog ── -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showResolveDialog" class="dialog-overlay" @click.self="showResolveDialog = false">
          <div class="dialog">
            <h2 class="dialog__title">Mark as Fixed</h2>
            <p class="dialog__body">
              <strong>{{ resolvingRequest?.equipment_item?.item_type }}</strong>
              — {{ resolvingRequest?.problem_description }}
            </p>

            <div class="field">
              <label class="field__label">Date fixed</label>
              <input v-model="resolveForm.date_resolved" type="date" class="field__input" :max="today" />
            </div>
            <div class="field">
              <label class="field__label">What was done? (optional)</label>
              <textarea v-model="resolveForm.action_taken" class="field__textarea" rows="3" placeholder="e.g., Replaced with new LED tube" />
            </div>

            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="showResolveDialog = false">Cancel</button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.resolveRequest"
                @click="handleResolve"
              >
                {{ store.loading.resolveRequest ? 'Saving…' : 'Mark as Fixed' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Edit Equipment Count Dialog ── -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showEditEquipment" class="dialog-overlay" @click.self="showEditEquipment = false">
          <div class="dialog">
            <h2 class="dialog__title">Edit Count — {{ editingItem?.item_type }}</h2>

            <template v-if="!editEquipmentConfirm">
              <div class="field">
                <label class="field__label">Total units</label>
                <input v-model.number="editEquipmentForm.total_count" type="number" class="field__input" min="0" />
              </div>
              <div class="field">
                <label class="field__label">Busted units</label>
                <input v-model.number="editEquipmentForm.busted_count" type="number" class="field__input" min="0" />
              </div>
              <div class="dialog__actions">
                <button class="dialog__btn dialog__btn--cancel" @click="showEditEquipment = false">Cancel</button>
                <button class="dialog__btn dialog__btn--confirm" @click="requestEquipmentConfirm">Review Changes</button>
              </div>
            </template>

            <template v-else>
              <div class="diff-view">
                <p class="diff-label">You are changing:</p>
                <div v-if="editingItem.total_count !== editEquipmentForm.total_count" class="diff-row">
                  <span class="diff-field">Total count</span>
                  <span><s class="diff-old">{{ editingItem.total_count }}</s> → <strong class="diff-new">{{ editEquipmentForm.total_count }}</strong></span>
                </div>
                <div v-if="editingItem.busted_count !== editEquipmentForm.busted_count" class="diff-row">
                  <span class="diff-field">Busted count</span>
                  <span><s class="diff-old">{{ editingItem.busted_count }}</s> → <strong class="diff-new">{{ editEquipmentForm.busted_count }}</strong></span>
                </div>
                <p class="diff-preview">
                  Working: {{ editEquipmentForm.total_count - editEquipmentForm.busted_count }}
                </p>
              </div>
              <p class="dialog__body">Is this correct?</p>
              <div class="dialog__actions">
                <button class="dialog__btn dialog__btn--cancel" @click="editEquipmentConfirm = false">Back</button>
                <button
                  class="dialog__btn dialog__btn--confirm"
                  :disabled="store.loading.updateEquipment"
                  @click="handleEditEquipment"
                >
                  {{ store.loading.updateEquipment ? 'Saving…' : 'Save Changes' }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- New Request FAB -->
    <button class="fab" @click="goToNewRequest">
      + Log Problem
    </button>

    <ToastNotification
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @done="toast.show = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useElectricalStore } from '@/stores/electrical'
import EquipmentSection    from '@/components/electrical/EquipmentSection.vue'
import AddItemModal        from '@/components/electrical/AddItemModal.vue'
import RequestCard         from '@/components/electrical/RequestCard.vue'
import ResolvedRequestCard from '@/components/electrical/ResolvedRequestCard.vue'
import EmptyState          from '@/components/common/EmptyState.vue'
import ToastNotification   from '@/components/common/ToastNotification.vue'

const props = defineProps({
  id:     { type: String, required: true },
  roomId: { type: String, required: true },
})

const router = useRouter()
const store  = useElectricalStore()

const today = new Date().toISOString().split('T')[0]

// UI state
const showHistory        = ref(false)
const showAllResolved    = ref(false)
const showResolveDialog  = ref(false)
const showEditEquipment  = ref(false)
const showAddItemModal   = ref(false)
const addItemCategory    = ref('')
const editEquipmentConfirm = ref(false)

// Resolve form
const resolvingRequest = ref(null)
const resolveForm = ref({ date_resolved: today, action_taken: '' })

// Equipment edit form
const editingItem         = ref(null)
const editEquipmentForm   = ref({ total_count: 0, busted_count: 0 })

const toast = ref({ show: false, message: '', type: 'success' })

const building = computed(() => store.currentBuilding)

const displayedResolved = computed(() =>
  showAllResolved.value
    ? store.resolvedRequests
    : store.resolvedRequests.slice(0, 3)
)

function goToNewRequest() {
  router.push({
    name: 'NewRequest',
    query: {
      building_id: props.id,
      floor_level: store.currentRoom?.floor_level,
      room_id:     props.roomId,
    },
  })
}

// ── Resolve ────────────────────────────────────────────────────────────────
function openResolveDialog(request) {
  resolvingRequest.value = request
  resolveForm.value = { date_resolved: today, action_taken: '' }
  showResolveDialog.value = true
}

async function handleResolve() {
  const result = await store.resolveRequest({
    request_id:   resolvingRequest.value.request_id,
    date_resolved: resolveForm.value.date_resolved,
    action_taken:  resolveForm.value.action_taken || undefined,
  })
  if (result) {
    showResolveDialog.value = false
    toast.value = { show: true, message: 'Marked as fixed.', type: 'success' }
    // Refresh room to update busted counts displayed
    await store.fetchRoomById(Number(props.roomId))
  } else {
    toast.value = { show: true, message: store.error.resolveRequest ?? 'Failed to resolve.', type: 'error' }
  }
}

// ── Edit Equipment ─────────────────────────────────────────────────────────
function openAddItem(categoryKey) {
  addItemCategory.value = categoryKey
  showAddItemModal.value = true
}

async function onItemAdded() {
  showAddItemModal.value = false
  await store.fetchRoomById(Number(props.roomId))
  toast.value = { show: true, message: 'Item added.', type: 'success' }
}

function openEditEquipment(item) {
  editingItem.value = { ...item }
  editEquipmentForm.value = { total_count: item.total_count, busted_count: item.busted_count }
  editEquipmentConfirm.value = false
  showEditEquipment.value = true
}

function requestEquipmentConfirm() {
  const f = editEquipmentForm.value
  if (f.busted_count > f.total_count) {
    toast.value = { show: true, message: 'Busted count cannot be more than total count.', type: 'error' }
    return
  }
  if (f.total_count < 0 || f.busted_count < 0) {
    toast.value = { show: true, message: 'Quantity must be a number and cannot be negative.', type: 'error' }
    return
  }
  editEquipmentConfirm.value = true
}

async function handleEditEquipment() {
  const f = editEquipmentForm.value
  const working = f.total_count - f.busted_count
  const reason = `Count changed — total: ${editingItem.value.total_count}→${f.total_count}, busted: ${editingItem.value.busted_count}→${f.busted_count}`

  const result = await store.updateEquipmentCount(
    editingItem.value.item_id,
    { total_count: f.total_count, busted_count: f.busted_count, working_count: working },
    reason
  )

  if (result) {
    showEditEquipment.value = false
    toast.value = { show: true, message: 'Item count updated.', type: 'success' }
  } else {
    toast.value = { show: true, message: store.error.updateEquipment ?? 'Failed to update.', type: 'error' }
  }
}

// ── Edit Request ───────────────────────────────────────────────────────────
function openEditRequest(request) {
  router.push({
    name: 'NewRequest',
    query: {
      edit: request.request_id,
      building_id: props.id,
      floor_level: store.currentRoom?.floor_level,
      room_id: props.roomId,
    },
  })
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    store.fetchBuildingById(Number(props.id)),
    store.fetchRoomById(Number(props.roomId)),
    store.fetchRequestsByRoom(Number(props.roomId)),
  ])
})
</script>

<style scoped>
.room-detail {
  max-width: 680px;
  margin: 0 auto;
  padding: 16px 16px 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header { display: flex; }
.back-btn { background: none; border: none; font-size: 16px; font-weight: 600; color: var(--blue); cursor: pointer; padding: 8px 0; min-height: 44px; }
/* Comment for now */
/* .room-header { }  */
.room-header__number { font-size: 28px; font-weight: 900; color: var(--text-primary); margin: 0; }
.room-header__name   { font-size: 16px; font-weight: 600; color: var(--text-secondary); margin: 4px 0 0; }
.room-header__meta   { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }

.card-section { display: flex; flex-direction: column; gap: 12px; }

.section-header { display: flex; justify-content: space-between; align-items: center; }

.section-title {
  font-size: 17px; font-weight: 700; color: var(--text-primary);
  margin: 0; display: flex; align-items: center; gap: 8px;
}

.count-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 24px; border-radius: 12px;
  font-size: 13px; font-weight: 800; padding: 0 6px;
}
.count-badge--red { background: #fee2e2; color: #b91c1c; }

.btn--new {
  padding: 10px 16px; background: var(--blue); color: #fff; border: none;
  border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; min-height: 48px;
}

.requests-list { display: flex; flex-direction: column; gap: 10px; }

.history-toggle {
  display: flex; justify-content: space-between; align-items: center;
  width: 100%; padding: 14px 16px; background: var(--surface);
  border: none; border-radius: 10px; font-size: 15px; font-weight: 700;
  color: var(--text-primary); cursor: pointer; min-height: 48px;
}

.history-empty { font-size: 14px; color: var(--text-secondary); padding: 8px 0; }

.see-all-btn {
  padding: 12px; border: 2px dashed var(--border); border-radius: 10px;
  background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer; min-height: 48px;
}

/* Skeleton */
.skeleton-header { height: 80px; border-radius: 12px; background-image: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
.skeleton-list { display: flex; flex-direction: column; gap: 10px; }
.skeleton-card { height: 120px; border-radius: 12px; background-image: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* FAB */
.fab { position: fixed; bottom: 80px; right: 20px; background: var(--blue); color: #fff; border: none; border-radius: 28px; padding: 14px 22px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); min-height: 52px; z-index: 100; }

/* Dialog */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9000; padding: 24px; }
.dialog { background: var(--surface); border-radius: 16px; padding: 28px 24px; width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 16px; max-height: 90vh; overflow-y: auto; }
.dialog__title { font-size: 18px; font-weight: 700; margin: 0; color: var(--text-primary); }
.dialog__body { font-size: 15px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.dialog__actions { display: flex; gap: 12px; justify-content: flex-end; }
.dialog__btn { padding: 12px 20px; border-radius: 8px; border: none; font-size: 15px; font-weight: 600; cursor: pointer; min-height: 48px; }
.dialog__btn--cancel { background: var(--bg); color: var(--text-secondary); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__input { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; min-height: 44px; width: 100%; box-sizing: border-box; }
.field__textarea { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; width: 100%; box-sizing: border-box; resize: vertical; min-height: 80px; line-height: 1.6; }

/* Diff view */
.diff-view { background: var(--bg); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.diff-label { font-size: 13px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
.diff-row { display: flex; flex-direction: column; gap: 2px; font-size: 14px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
.diff-field { font-weight: 600; color: var(--text-primary); }
.diff-old { color: var(--red); }
.diff-new { color: var(--green); }
.diff-preview { font-size: 14px; color: var(--text-secondary); margin: 0; }

.dialog-enter-active, .dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: scale(0.96); }
</style>

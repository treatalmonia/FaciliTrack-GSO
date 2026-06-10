<template>
  <div class="building-view">

    <!-- Back + Header -->
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">‹ Back</button>
      
    </div>

    <div><button
  class="cross-link"
  @click="$router.push({ name: 'FireSafetyDetail', params: { id: props.id } })"
>
  🧯 View Fire Safety Status
</button></div>

    <div v-if="store.loading.currentBuilding" class="skeleton-header" />

    <template v-else-if="store.currentBuilding">
      <header class="building-header">
        <div>
          <h1 class="building-header__name">{{ store.currentBuilding.building_name }}</h1>
          <p v-if="store.currentBuilding.college_or_department" class="building-header__dept">
            {{ store.currentBuilding.college_or_department }}
          </p>
        </div>
      </header>

      <!-- Floor tabs -->
      <FloorTabs
        v-model="activeFloor"
        :floors="floors"
      />

      <!-- Floor summary -->
      <div class="floor-summary">
        <span class="floor-summary__label">Issues on this floor:</span>
        <span class="floor-summary__count" :class="{ 'floor-summary__count--alert': floorBustedCount > 0 }">
          {{ floorBustedCount }}
        </span>
      </div>

      <!-- Loading rooms -->
      <div v-if="store.loading.rooms" class="skeleton-list">
        <div v-for="n in 3" :key="n" class="skeleton-card" />
      </div>

      <!-- Empty floor -->
      <EmptyState
        v-else-if="!roomsOnFloor.length"
        icon="🚪"
        title="No rooms on this floor yet."
        subtitle="Add rooms to start tracking equipment and requests."
        action-label="Add a Room"
        @action="showAddRoom = true"
      />

      <!-- Room list (only rooms with open requests, unless showAll) -->
      <div v-else class="rooms-list">
        <RoomCard
            v-for="room in visibleRooms"
            :key="room.room_id"
            :room="room"
            :open-count="openCountByRoom[room.room_id] ?? 0"
            :busted-count="(room.equipment_item ?? []).reduce((s, e) => s + (e.busted_count ?? 0), 0)"
            @click="goToRoom(room)"
            @edit-room="openEditRoom(room)"
          />

        <button
          v-if="hiddenRooms > 0"
          class="show-all-btn"
          @click="showAllRooms = true"
        >
          Show all rooms ({{ hiddenRooms }} with no issues)
        </button>
      </div>

      <!-- Edit Room Number -->
      <Teleport to="body">
        <Transition name="dialog">
          <div v-if="showEditRoom" class="dialog-overlay" @click.self="showEditRoom = false">
            <div class="dialog">
              <h2 class="dialog__title">Edit Room Number</h2>
              <div class="field">
                <label class="field__label">Room number or code *</label>
                <input v-model="editRoomNumber" class="field__input" placeholder="e.g., BH 101" />
              </div>
              <p v-if="editRoomError" class="field__error">{{ editRoomError }}</p>
              <div class="dialog__actions">
                <button class="dialog__btn dialog__btn--cancel" @click="showEditRoom = false">Cancel</button>
                <button class="dialog__btn dialog__btn--confirm" :disabled="store.loading.editRoom" @click="handleEditRoom">
                  {{ store.loading.editRoom ? 'Saving…' : 'Save' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Add Room button -->
      <button class="btn btn--add-room" @click="showAddRoom = true">
        + Add Room
      </button>
    </template>

    <!-- Add Room modal -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showAddRoom" class="dialog-overlay" @click.self="showAddRoom = false">
          <div class="dialog">
            <h2 class="dialog__title">Add Room</h2>

            <div class="field">
              <label class="field__label">Floor *</label>
              <select v-model="newRoom.floor_level" class="field__select">
                <option value="" disabled>Select floor</option>
                <option v-for="f in floors" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="field">
              <label class="field__label">Room number or code *</label>
              <input v-model="newRoom.room_number" class="field__input" placeholder="e.g., KH 105, BH 117" />
            </div>
            <div class="field">
              <label class="field__label">Room type / utilization *</label>
              <ComboBox
                v-model="newRoom.room_name"
                :options="roomTypes"
                placeholder="e.g., Classroom, Laboratory"
                @add="onRoomTypeAdded"
              />
            </div>
            <div class="field">
              <label class="field__label">Room size in square meters (optional)</label>
              <input v-model.number="newRoom.floor_area_sqm" type="number" class="field__input" placeholder="e.g., 45" />
            </div>

            <p v-if="addRoomError" class="field__error">{{ addRoomError }}</p>

            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="showAddRoom = false">Cancel</button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.addRoom"
                @click="handleAddRoom"
              >
                {{ store.loading.addRoom ? 'Saving…' : 'Add Room' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- New Request FAB -->
    <button class="fab" @click="$router.push({ name: 'NewRequest' })">
      + New Request
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
import FloorTabs         from '@/components/electrical/FloorTabs.vue'
import ComboBox          from '@/components/common/ComboBox.vue'
import RoomCard          from '@/components/electrical/RoomCard.vue'
import EmptyState        from '@/components/common/EmptyState.vue'
import ToastNotification from '@/components/common/ToastNotification.vue'

const props = defineProps({ id: { type: String, required: true } })

const router = useRouter()
const store  = useElectricalStore()

const FLOOR_LABELS = [
  'Ground Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor',
  '6th Floor', '7th Floor', '8th Floor', '9th Floor', '10th Floor',
]

/* Comment for now */
// const ROOM_TYPES = [
//   'Classroom', 'Computer Lab', 'Faculty Room', 'Conference Room',
//   'AVR (Audio Visual Room)', "Dean's Office", 'Laboratory',
//   'Comfort Room', 'Hallway', 'Lobby', 'Electrical Room',
//   'Storage Room', 'Accreditation Room', 'Group Processing Room', 'Other',
// ]

const activeFloor    = ref('Ground Floor')

const roomTypes = ref(
  JSON.parse(localStorage.getItem('faciltrack_room_types') ?? '[]')
)

function onRoomTypeAdded(val) {
  if (!roomTypes.value.includes(val)) {
    roomTypes.value.push(val)
    localStorage.setItem('faciltrack_room_types', JSON.stringify(roomTypes.value))
  }
}
const showAllRooms   = ref(false)
const showAddRoom = computed({
  get: () => _showAddRoom.value,
  set: (val) => {
    _showAddRoom.value = val
    if (val) newRoom.value.floor_level = activeFloor.value
  },
})
const _showAddRoom = ref(false)
const addRoomError   = ref('')
const showEditRoom   = ref(false)
const editRoomNumber = ref('')
const editRoomError  = ref('')
const editingRoom    = ref(null)

function openEditRoom(room) {
  editingRoom.value    = room
  editRoomNumber.value = room.room_number
  editRoomError.value  = ''
  showEditRoom.value   = true
}

async function handleEditRoom() {
  if (!editRoomNumber.value.trim()) { editRoomError.value = 'Room number cannot be empty.'; return }
  const result = await store.updateRoomNumber(editingRoom.value.room_id, editRoomNumber.value.trim())
  if (result) {
    showEditRoom.value = false
    toast.value = { show: true, message: 'Room number updated.', type: 'success' }
  } else {
    editRoomError.value = store.error.editRoom ?? 'Failed to update.'
  }
}
const toast          = ref({ show: false, message: '', type: 'success' })

const newRoom = ref({
  floor_level: '', room_number: '', room_name: '',
  room_name_custom: '', floor_area_sqm: null,
})

const floors = computed(() => {
  const n = store.currentBuilding?.number_of_floors ?? 1
  return FLOOR_LABELS.slice(0, n)
})

const roomsOnFloor = computed(() =>
  store.rooms.filter((r) => r.floor_level === activeFloor.value)
)

// Open count per room (from the local requests data or allOpenRequests)
const openCountByRoom = computed(() => {
  const map = {}
  for (const req of store.allOpenRequests) {
    if (req.room?.room_id) {
      map[req.room.room_id] = (map[req.room.room_id] ?? 0) + 1
    }
  }
  return map
})

const visibleRooms = computed(() => {
  if (showAllRooms.value) return roomsOnFloor.value
  return roomsOnFloor.value.filter((r) => {
    const hasOpen   = (openCountByRoom.value[r.room_id] ?? 0) > 0
    const hasBusted = (r.equipment_item ?? []).reduce((s, e) => s + (e.busted_count ?? 0), 0) > 0
    return hasOpen || hasBusted
  })
})

const hiddenRooms = computed(() =>
  roomsOnFloor.value.length - visibleRooms.value.length
)

const floorBustedCount = computed(() =>
  roomsOnFloor.value.reduce((sum, room) => {
    const busted = (room.equipment_item ?? []).reduce(
      (s, e) => s + (e.busted_count ?? 0), 0
    )
    return sum + busted
  }, 0)
)

function goToRoom(room) {
  router.push({
    name: 'RoomDetail',
    params: { id: props.id, roomId: room.room_id },
  })
}

async function handleAddRoom() {
  addRoomError.value = ''
  if (!newRoom.value.floor_level) { addRoomError.value = 'Please select a floor.'; return }
  if (!newRoom.value.room_number.trim()) { addRoomError.value = 'Please enter a room number.'; return }
  if (!newRoom.value.room_name) { addRoomError.value = 'Please select a room type.'; return }

  const finalName = newRoom.value.room_name === 'Other'
    ? newRoom.value.room_name_custom
    : newRoom.value.room_name

  const result = await store.addRoom({
    building_id:   Number(props.id),
    floor_level:   newRoom.value.floor_level,
    room_number:   newRoom.value.room_number.trim(),
    room_name:     finalName,
    floor_area_sqm: newRoom.value.floor_area_sqm || null,
  })

  if (result) {
    // Save room type to local suggestions if not already there
    const typeName = finalName.trim()
    if (typeName && !roomTypes.value.includes(typeName)) {
      roomTypes.value.push(typeName)
      localStorage.setItem('faciltrack_room_types', JSON.stringify(roomTypes.value))
    }
    showAddRoom.value = false
    newRoom.value = { floor_level: activeFloor.value, room_number: '', room_name: '', room_name_custom: '', floor_area_sqm: null }
    toast.value = { show: true, message: 'Room added.', type: 'success' }
    activeFloor.value = result.floor_level
    showAllRooms.value = true
  } else {
    addRoomError.value = store.error.addRoom ?? 'Failed to add room.'
  }
}

onMounted(async () => {
  const bid = Number(props.id)
  await Promise.all([
    store.fetchBuildingById(bid),
    store.fetchRoomsByBuilding(bid),
    store.fetchAllOpenRequests(),
  ])
  // Default to floor with most open requests
  if (floors.value.length) {
    const floorCounts = {}
    for (const req of store.allOpenRequests) {
      // match room to floor via store.rooms
      const room = store.rooms.find((r) => r.room_id === req.room?.room_id)
      if (room) {
        floorCounts[room.floor_level] = (floorCounts[room.floor_level] ?? 0) + 1
      }
    }
    const bestFloor = Object.entries(floorCounts).sort((a, b) => b[1] - a[1])[0]
    activeFloor.value = bestFloor ? bestFloor[0] : floors.value[0]
  }
})
</script>

<style scoped>
.building-view {
  max-width: 680px;
  margin: 0 auto;
  padding: 16px 16px 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header { display: flex; align-items: center; }
.back-btn {
  background: none; border: none; font-size: 16px; font-weight: 600;
  color: var(--blue); cursor: pointer; padding: 8px 0; min-height: 44px;
}
/* Comment for now */
/* .building-header { } */
.building-header__name { font-size: 24px; font-weight: 800; color: var(--text-primary); margin: 0; }
.building-header__dept { font-size: 13px; color: var(--text-secondary); margin: 4px 0 0; }

.floor-summary {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border-radius: 10px; padding: 12px 16px;
}
.floor-summary__label { font-size: 14px; color: var(--text-secondary); }
.floor-summary__count { font-size: 20px; font-weight: 800; color: var(--text-primary); }
.floor-summary__count--alert { color: var(--red); }

.rooms-list { display: flex; flex-direction: column; gap: 8px; }

.show-all-btn {
  width: 100%; padding: 12px; background: none; border: 2px dashed var(--border);
  border-radius: 10px; color: var(--text-secondary); font-size: 14px;
  cursor: pointer; min-height: 48px;
}

.btn--add-room {
  padding: 14px; border: 2px dashed var(--blue); border-radius: 10px;
  background: none; color: var(--blue); font-size: 15px; font-weight: 600;
  cursor: pointer; min-height: 52px; text-align: center;
}

/* Skeleton */
.skeleton-header { height: 60px; border-radius: 12px; background: #f0f0f0; animation: shimmer 1.2s infinite; background-size: 200% 100%; background-image: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); }
.skeleton-list { display: flex; flex-direction: column; gap: 8px; }
.skeleton-card { height: 64px; border-radius: 10px; background-image: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* FAB */
.fab { position: fixed; bottom: 80px; right: 20px; background: var(--blue); color: #fff; border: none; border-radius: 28px; padding: 14px 22px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); min-height: 52px; z-index: 100; }

/* Dialog */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9000; padding: 24px; }
.dialog { background: var(--surface); border-radius: 16px; padding: 28px 24px; width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
.dialog__title { font-size: 18px; font-weight: 700; margin: 0; color: var(--text-primary); }
.dialog__actions { display: flex; gap: 12px; justify-content: flex-end; }
.dialog__btn { padding: 12px 20px; border-radius: 8px; border: none; font-size: 15px; font-weight: 600; cursor: pointer; min-height: 48px; }
.dialog__btn--cancel { background: var(--bg); color: var(--text-secondary); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__input, .field__select { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; min-height: 44px; width: 100%; box-sizing: border-box; }
.field__error { font-size: 13px; color: var(--red); margin: 0; }

.dialog-enter-active, .dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: scale(0.96); }
</style>

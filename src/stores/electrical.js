import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useElectricalStore = defineStore('electrical', () => {
  // ─── State ────────────────────────────────────────────────────────────────
  const buildings     = ref([])
  const currentBuilding = ref(null)
  const rooms         = ref([])
  const currentRoom   = ref(null)
  const requests      = ref([])
  const allOpenRequests = ref([])   // cross-building, for dashboard counter

  const loading = ref({
    buildings:      false,
    currentBuilding: false,
    rooms:          false,
    currentRoom:    false,
    requests:       false,
    allOpen:        false,
    addRequest:     false,
    resolveRequest: false,
    editRequest:    false,
    archiveRequest: false,
    addBuilding:    false,
    editBuilding:   false,
    addRoom:        false,
    editRoom:       false,
    updateEquipment: false,
  })

  const error = ref({
    buildings:      null,
    currentBuilding: null,
    rooms:          null,
    currentRoom:    null,
    requests:       null,
    allOpen:        null,
    addRequest:     null,
    resolveRequest: null,
    editRequest:    null,
    archiveRequest: null,
    addBuilding:    null,
    editBuilding:   null,
    addRoom:        null,
    editRoom:       null,
    updateEquipment:    null,
    addEquipmentItem:   null,
  })

  // ─── Getters ──────────────────────────────────────────────────────────────
  const openRequests = computed(() =>
    requests.value.filter((r) => r.status === 'Open')
  )

  const resolvedRequests = computed(() =>
    requests.value.filter((r) => r.status === 'Resolved')
  )

  /**
   * Total open request count across the entire system (for dashboard badge).
   */
  const totalOpenCount = computed(() => allOpenRequests.value.length)

  /**
   * Returns a map of building_id → open request count.
   * Used by the dashboard to colour-code each building card.
   */
  const openCountByBuilding = computed(() => {
    const map = {}
    for (const req of allOpenRequests.value) {
      map[req.room?.building_id] = (map[req.room?.building_id] ?? 0) + 1
    }
    return map
  })

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function setLoading(key, value) { loading.value[key] = value }
  function setError(key, value)   { error.value[key]   = value }
  function clearError(key)        { error.value[key]   = null  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  /**
   * Fetch all buildings (dashboard list).
   */
  async function fetchBuildings() {
    setLoading('buildings', true)
    clearError('buildings')
    try {
      const { data, error: sbError } = await supabase
        .from('building')
        .select('building_id, building_name, number_of_floors, college_or_department')
        .order('building_name', { ascending: true })

      if (sbError) throw sbError
      buildings.value = data ?? []
    } catch (err) {
      setError('buildings', err.message ?? 'Failed to load buildings.')
      console.error('[electrical] fetchBuildings:', err)
    } finally {
      setLoading('buildings', false)
    }
  }

  /**
   * Fetch a single building by ID (Building View header).
   * @param {number} buildingId
   */
  async function fetchBuildingById(buildingId) {
    setLoading('currentBuilding', true)
    clearError('currentBuilding')
    try {
      const { data, error: sbError } = await supabase
        .from('building')
        .select('building_id, building_name, number_of_floors, college_or_department')
        .eq('building_id', buildingId)
        .single()

      if (sbError) throw sbError
      currentBuilding.value = data
    } catch (err) {
      setError('currentBuilding', err.message ?? 'Failed to load building.')
      console.error('[electrical] fetchBuildingById:', err)
    } finally {
      setLoading('currentBuilding', false)
    }
  }

  /**
   * Fetch all open requests across ALL buildings (for dashboard total counter
   * and per-building open counts).
   */
  async function fetchAllOpenRequests() {
    setLoading('allOpen', true)
    clearError('allOpen')
    try {
      const { data, error: sbError } = await supabase
        .from('repair_request')
        .select(`
          request_id,
          status,
          room:room_id (
            room_id,
            building_id
          )
        `)
        .eq('status', 'Open')

      if (sbError) throw sbError
      allOpenRequests.value = data ?? []
    } catch (err) {
      setError('allOpen', err.message ?? 'Failed to load open requests.')
      console.error('[electrical] fetchAllOpenRequests:', err)
    } finally {
      setLoading('allOpen', false)
    }
  }

  /**
   * Fetch all rooms for a building, including their equipment items.
   * @param {number} buildingId
   */
  async function fetchRoomsByBuilding(buildingId) {
    setLoading('rooms', true)
    clearError('rooms')
    try {
      const { data, error: sbError } = await supabase
        .from('room')
        .select(`
          room_id,
          building_id,
          floor_level,
          room_number,
          room_name,
          floor_area_sqm,
          equipment_item (
            item_id,
            category,
            item_type,
            total_count,
            busted_count,
            working_count,
            wattage_per_unit,
            last_updated_date
          )
        `)
        .eq('building_id', buildingId)
        .order('floor_level', { ascending: true })
        .order('room_number',  { ascending: true })

      if (sbError) throw sbError
      rooms.value = data ?? []
    } catch (err) {
      setError('rooms', err.message ?? 'Failed to load rooms.')
      console.error('[electrical] fetchRoomsByBuilding:', err)
    } finally {
      setLoading('rooms', false)
    }
  }

  /**
   * Fetch a single room by ID (Room Detail header).
   * @param {number} roomId
   */
  async function fetchRoomById(roomId) {
    setLoading('currentRoom', true)
    clearError('currentRoom')
    try {
      const { data, error: sbError } = await supabase
        .from('room')
        .select(`
          room_id,
          building_id,
          floor_level,
          room_number,
          room_name,
          floor_area_sqm,
          equipment_item (
            item_id,
            category,
            item_type,
            total_count,
            busted_count,
            working_count,
            wattage_per_unit,
            last_updated_date
          )
        `)
        .eq('room_id', roomId)
        .single()

      if (sbError) throw sbError
      currentRoom.value = data
    } catch (err) {
      setError('currentRoom', err.message ?? 'Failed to load room.')
      console.error('[electrical] fetchRoomById:', err)
    } finally {
      setLoading('currentRoom', false)
    }
  }

  /**
   * Fetch all repair requests for a room (open + resolved history).
   * @param {number} roomId
   */
  async function fetchRequestsByRoom(roomId) {
    setLoading('requests', true)
    clearError('requests')
    try {
      const { data, error: sbError } = await supabase
        .from('repair_request')
        .select(`
          request_id,
          room_id,
          item_id,
          problem_description,
          quantity_affected,
          date_reported,
          date_resolved,
          action_taken,
          status,
          reported_by,
          notes,
          equipment_item (
            item_id,
            category,
            item_type,
            total_count,
            busted_count,
            working_count,
            wattage_per_unit
          )
        `)
        .eq('room_id', roomId)
        .order('date_reported', { ascending: false })

      if (sbError) throw sbError
      requests.value = data ?? []
    } catch (err) {
      setError('requests', err.message ?? 'Failed to load requests.')
      console.error('[electrical] fetchRequestsByRoom:', err)
    } finally {
      setLoading('requests', false)
    }
  }

  /**
   * Add a new repair request.
   */
  async function addRequest(payload) {
    setLoading('addRequest', true)
    clearError('addRequest')
    try {
      const insertData = {
        item_id:             payload.item_id,
        room_id:             payload.room_id,
        problem_description: payload.problem_description,
        quantity_affected:   payload.quantity_affected ?? 1,
        date_reported:       payload.date_reported,
        status:              'Open',
        ...(payload.reported_by && { reported_by: payload.reported_by }),
        ...(payload.notes       && { notes:        payload.notes }),
      }

      const { data, error: sbError } = await supabase
        .from('repair_request')
        .insert(insertData)
        .select(`
          request_id, room_id, item_id, problem_description,
          quantity_affected, date_reported, date_resolved,
          action_taken, status, reported_by, notes,
          equipment_item (
            item_id, category, item_type,
            total_count, busted_count, working_count, wattage_per_unit
          )
        `)
        .single()

      if (sbError) throw sbError

      // Bump the equipment busted_count immediately
      await supabase
        .from('equipment_item')
        .update({ busted_count: supabase.rpc('increment_busted', { row_id: payload.item_id, amount: payload.quantity_affected ?? 1 }) })
        .eq('item_id', payload.item_id)

      requests.value.unshift(data)
      return data
    } catch (err) {
      setError('addRequest', err.message ?? 'Failed to add request.')
      console.error('[electrical] addRequest:', err)
      return null
    } finally {
      setLoading('addRequest', false)
    }
  }

  /**
   * Edit an existing repair request (notes and item_type only if resolved;
   * full edit if still open).
   */
  async function editRequest(payload) {
    setLoading('editRequest', true)
    clearError('editRequest')
    try {
      const { request_id, ...fields } = payload
      const { data, error: sbError } = await supabase
        .from('repair_request')
        .update(fields)
        .eq('request_id', request_id)
        .select()
        .single()

      if (sbError) throw sbError

      const idx = requests.value.findIndex((r) => r.request_id === request_id)
      if (idx !== -1) requests.value[idx] = { ...requests.value[idx], ...data }

      // Write to audit log
      await writeAuditLog('repair_request', request_id, `Request #${request_id} edited`)

      return data
    } catch (err) {
      setError('editRequest', err.message ?? 'Failed to edit request.')
      console.error('[electrical] editRequest:', err)
      return null
    } finally {
      setLoading('editRequest', false)
    }
  }

  /**
   * Mark a repair request as Resolved.
   */
  async function resolveRequest(payload) {
    setLoading('resolveRequest', true)
    clearError('resolveRequest')
    try {
      const updateData = {
        status:       'Resolved',
        date_resolved: payload.date_resolved,
        ...(payload.action_taken && { action_taken: payload.action_taken }),
        ...(payload.notes        && { notes:         payload.notes }),
      }

      const { data, error: sbError } = await supabase
        .from('repair_request')
        .update(updateData)
        .eq('request_id', payload.request_id)
        .select()
        .single()

      if (sbError) throw sbError

      // Decrement busted_count on the linked equipment item
      const req = requests.value.find((r) => r.request_id === payload.request_id)
      if (req) {
        const qty = req.quantity_affected ?? 1
        const item = req.equipment_item
        if (item) {
          const newBusted = Math.max(0, (item.busted_count ?? 0) - qty)
          await supabase
            .from('equipment_item')
            .update({ busted_count: newBusted })
            .eq('item_id', item.item_id)
        }
      }

      // Sync local state
      const idx = requests.value.findIndex((r) => r.request_id === payload.request_id)
      if (idx !== -1) requests.value[idx] = { ...requests.value[idx], ...data }

      return data
    } catch (err) {
      setError('resolveRequest', err.message ?? 'Failed to resolve request.')
      console.error('[electrical] resolveRequest:', err)
      return null
    } finally {
      setLoading('resolveRequest', false)
    }
  }

  /**
   * Soft-archive (hide) a repair request. Never hard-deletes.
   */
  async function archiveRequest(requestId, reason) {
    setLoading('archiveRequest', true)
    clearError('archiveRequest')
    try {
      const { data, error: sbError } = await supabase
        .from('repair_request')
        .update({ status: 'Archived', notes: reason })
        .eq('request_id', requestId)
        .select()
        .single()

      if (sbError) throw sbError

      const idx = requests.value.findIndex((r) => r.request_id === requestId)
      if (idx !== -1) requests.value.splice(idx, 1)

      await writeAuditLog('repair_request', requestId, `Archived: ${reason}`)
      return data
    } catch (err) {
      setError('archiveRequest', err.message ?? 'Failed to remove request.')
      console.error('[electrical] archiveRequest:', err)
      return null
    } finally {
      setLoading('archiveRequest', false)
    }
  }

  /**
   * Update equipment item counts (working / busted).
   * Requires a reason string — writes to audit log.
   */
  async function updateEquipmentCount(itemId, fields, reason) {
    setLoading('updateEquipment', true)
    clearError('updateEquipment')
    try {
      const { data, error: sbError } = await supabase
        .from('equipment_item')
        .update({ ...fields, last_updated_date: new Date().toISOString().split('T')[0] })
        .eq('item_id', itemId)
        .select()
        .single()

      if (sbError) throw sbError

      // Update inside currentRoom local state
      if (currentRoom.value?.equipment_item) {
        const idx = currentRoom.value.equipment_item.findIndex((e) => e.item_id === itemId)
        if (idx !== -1) {
          currentRoom.value.equipment_item[idx] = {
            ...currentRoom.value.equipment_item[idx],
            ...data,
          }
        }
      }

      await writeAuditLog('equipment_item', itemId, reason)
      return data
    } catch (err) {
      setError('updateEquipment', err.message ?? 'Failed to update equipment.')
      console.error('[electrical] updateEquipmentCount:', err)
      return null
    } finally {
      setLoading('updateEquipment', false)
    }
  }

  /**
   * Add a new building.
   */
  async function addBuilding(payload) {
    setLoading('addBuilding', true)
    clearError('addBuilding')
    try {
      const { data, error: sbError } = await supabase
        .from('building')
        .insert({
          building_name:        payload.building_name,
          number_of_floors:     payload.number_of_floors,
          college_or_department: payload.college_or_department ?? null,
        })
        .select()
        .single()

      if (sbError) throw sbError
      buildings.value.push(data)
      buildings.value.sort((a, b) => a.building_name.localeCompare(b.building_name))
      return data
    } catch (err) {
      setError('addBuilding', err.message ?? 'Failed to add building.')
      console.error('[electrical] addBuilding:', err)
      return null
    } finally {
      setLoading('addBuilding', false)
    }
  }

  /**
   * Edit a building's name or details.
   */
  async function editBuilding(buildingId, fields) {
    setLoading('editBuilding', true)
    clearError('editBuilding')
    try {
      const { data, error: sbError } = await supabase
        .from('building')
        .update(fields)
        .eq('building_id', buildingId)
        .select()
        .single()

      if (sbError) throw sbError

      const idx = buildings.value.findIndex((b) => b.building_id === buildingId)
      if (idx !== -1) buildings.value[idx] = { ...buildings.value[idx], ...data }
      if (currentBuilding.value?.building_id === buildingId) {
        currentBuilding.value = { ...currentBuilding.value, ...data }
      }

      await writeAuditLog('building', buildingId, `Building updated`)
      return data
    } catch (err) {
      setError('editBuilding', err.message ?? 'Failed to edit building.')
      console.error('[electrical] editBuilding:', err)
      return null
    } finally {
      setLoading('editBuilding', false)
    }
  }

  /**
   * Add a new room to a building.
   */
  async function addRoom(payload) {
    setLoading('addRoom', true)
    clearError('addRoom')
    try {
      const { data, error: sbError } = await supabase
        .from('room')
        .insert({
          building_id:   payload.building_id,
          floor_level:   payload.floor_level,
          room_number:   payload.room_number,
          room_name:     payload.room_name,
          floor_area_sqm: payload.floor_area_sqm ?? null,
        })
        .select()
        .single()

      if (sbError) throw sbError
      rooms.value.push({ ...data, equipment_item: [] })
      return data
    } catch (err) {
      setError('addRoom', err.message ?? 'Failed to add room.')
      console.error('[electrical] addRoom:', err)
      return null
    } finally {
      setLoading('addRoom', false)
    }
  }

  /**
   * Edit a room's details.
   */
  async function editRoom(roomId, fields) {
    setLoading('editRoom', true)
    clearError('editRoom')
    try {
      const { data, error: sbError } = await supabase
        .from('room')
        .update(fields)
        .eq('room_id', roomId)
        .select()
        .single()

      if (sbError) throw sbError

      const idx = rooms.value.findIndex((r) => r.room_id === roomId)
      if (idx !== -1) rooms.value[idx] = { ...rooms.value[idx], ...data }
      if (currentRoom.value?.room_id === roomId) {
        currentRoom.value = { ...currentRoom.value, ...data }
      }

      await writeAuditLog('room', roomId, `Room updated`)
      return data
    } catch (err) {
      setError('editRoom', err.message ?? 'Failed to edit room.')
      console.error('[electrical] editRoom:', err)
      return null
    } finally {
      setLoading('editRoom', false)
    }
  }

  // ─── Internal: Audit Log ──────────────────────────────────────────────────
  async function writeAuditLog(entityType, entityId, description) {
    try {
      await supabase.from('audit_log').insert({
        entity_type:        entityType,
        entity_id:          String(entityId),
        change_description: description,
        changed_date:       new Date().toISOString(),
      })
    } catch (err) {
      // Audit log failure is non-blocking — never surface to user
      console.warn('[electrical] audit log write failed:', err)
    }
  }

  /**
   * Add a new equipment item to a room.
   */
  async function updateRoomNumber(roomId, roomNumber) {
    return await editRoom(roomId, { room_number: roomNumber })
  }

  async function addEquipmentItem(payload) {
    try {
      const { data, error: sbError } = await supabase
        .from('equipment_item')
        .insert({ ...payload, last_updated_date: new Date().toISOString().split('T')[0] })
        .select()
        .single()

      if (sbError) throw sbError

      // Add it into the local rooms state so the dropdown updates immediately
      const room = rooms.value.find((r) => r.room_id === payload.room_id)
      if (room) room.equipment_item.push(data)

      return data
    } catch (err) {
      setError('addEquipmentItem', err.message ?? 'Failed to add item.')
      console.error('[electrical] addEquipmentItem:', err)
      return null
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  function $reset() {
    buildings.value      = []
    currentBuilding.value = null
    rooms.value          = []
    currentRoom.value    = null
    requests.value       = []
    allOpenRequests.value = []
    Object.keys(loading.value).forEach((k) => (loading.value[k] = false))
    Object.keys(error.value).forEach((k)   => (error.value[k]   = null))
  }

  return {
    // state
    buildings, currentBuilding,
    rooms, currentRoom,
    requests, allOpenRequests,
    loading, error,
    // getters
    openRequests, resolvedRequests,
    totalOpenCount, openCountByBuilding,
    // actions
    fetchBuildings, fetchBuildingById,
    fetchAllOpenRequests,
    fetchRoomsByBuilding, fetchRoomById,
    fetchRequestsByRoom,
    addRequest, editRequest, resolveRequest, archiveRequest,
    updateEquipmentCount,
    addBuilding, editBuilding,
    addRoom, editRoom, updateRoomNumber,
    addEquipmentItem,
    $reset,
  }
})

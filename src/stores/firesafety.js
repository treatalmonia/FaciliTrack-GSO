import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

/**
 * ─── SCHEMA REFERENCE ────────────────────────────────────────────────────────
 *
 * fire_building_compliance
 *   compliance_id, building_id, bfp_ready, last_inspection_date,
 *   last_updated_date, remarks,
 *   fire_hose_cabinet (bool), evacuation_plan_count (int),
 *   exit_right (bool), exit_left (bool), exit_sign (bool),
 *   led_exit_count (int), sprinkler_system (bool), smoke_detector (bool)
 *
 * fire_floor_compliance  — child of fire_building_compliance via compliance_id
 *   floor_compliance_id, compliance_id, floor_level,
 *   fe_10lbs_on_site, fe_5lbs_on_site, fe_hcfc_on_site,
 *   fe_10lbs_needed,  fe_5lbs_needed,  fe_hcfc_needed,
 *   emergency_lights_on_site, emergency_lights_needed
 *
 * fire_extinguisher_unit
 *   unit_id, building_id, floor_level, room_location,
 *   fe_size            CHECK IN ('5lbs', '10lbs', 'HCFC')
 *   installation_type  CHECK IN ('Box Type', 'Hang Type', 'On Floor')
 *   quantity_at_location,
 *   date_purchased_or_refilled, date_expires,
 *   supplier (default 'TRI J&A'), warranty_years CHECK IN (1, 2),
 *   current_condition  CHECK IN ('FULL', 'EMPTY', 'DAMAGED', 'EXPIRED')
 *   actions_needed (text, nullable)
 *
 *   NOTE: 'REFILLED' is NOT a valid condition value.
 *   When a unit is refilled: set condition = 'FULL', update dates.
 *
 * fire_extinguisher_movement
 *   movement_id, unit_id (NOT NULL), from_building_id, from_floor,
 *   from_room (NOT NULL), to_building_id, to_floor, to_room,
 *   to_supplier,
 *   movement_type  CHECK IN ('Removed','Sent for Refill','Transferred',
 *                             'Returned','New Unit Added')
 *   quantity_moved, movement_date, expected_return_date,
 *   status         CHECK IN ('Complete', 'Pending Return')
 *   notes, count_before (NOT NULL), count_after (NOT NULL)
 *
 *   NOTE: fe_size is NOT a column on fire_extinguisher_movement.
 *   It lives on fire_extinguisher_unit. The form passes fe_size as a
 *   helper payload field for floor count adjustments only.
 *
 * compliance_feature_log
 *   log_id, building_id, feature_name, old_value, new_value,
 *   changed_date, changed_by
 *
 * audit_log
 *   entity_type  CHECK IN ('Equipment', 'Request')  — NOT for fire safety
 *   Fire safety changes go to compliance_feature_log instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const useFireSafetyStore = defineStore('firesafety', () => {
  // ─── State ────────────────────────────────────────────────────────────────
  const buildings             = ref([])
  const compliances           = ref([])   // fire_building_compliance rows
  const floorCompliances      = ref([])   // fire_floor_compliance rows (all buildings)
  const units                 = ref([])   // fire_extinguisher_unit rows (all)
  const movements             = ref([])   // fire_extinguisher_movement rows

  // Current building detail (Screen B)
  const currentCompliance       = ref(null)
  const currentFloorCompliances = ref([])
  const currentUnits            = ref([])

  const loading = ref({
    buildings:       false,
    compliances:     false,
    units:           false,
    movements:       false,
    currentBuilding: false,
    saveCompliance:  false,
    saveFloorFE:     false,
    logCondition:    false,
    logMovement:     false,
  })

  const error = ref({
    buildings:       null,
    compliances:     null,
    units:           null,
    movements:       null,
    currentBuilding: null,
    saveCompliance:  null,
    saveFloorFE:     null,
    logCondition:    null,
    logMovement:     null,
  })

  // ─── Internal helpers ─────────────────────────────────────────────────────
  const todayStr = () => new Date().toISOString().split('T')[0]

  function setLoading(k, v) { loading.value[k] = v }
  function setError(k, v)   { error.value[k]   = v }
  function clearError(k)    { error.value[k]   = null }

  /**
   * Auto-calculate expiry date: exactly 2 years from a given date.
   * This is ALWAYS computed — never typed by the user.
   */
  function addTwoYears(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    d.setFullYear(d.getFullYear() + 2)
    return d.toISOString().split('T')[0]
  }

  function daysUntilExpiry(expiryDateStr) {
    if (!expiryDateStr) return null
    const diff = new Date(expiryDateStr) - new Date(todayStr())
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** Units past their expiry date. */
  const expiredUnits = computed(() =>
    units.value
      .filter((u) => {
        const days = daysUntilExpiry(u.date_expires)
        return days !== null && days < 0
      })
      .sort((a, b) => new Date(a.date_expires) - new Date(b.date_expires))
  )

  /** Units expiring within the next 60 days (not yet expired). */
  const expiringSoonUnits = computed(() =>
    units.value
      .filter((u) => {
        const days = daysUntilExpiry(u.date_expires)
        return days !== null && days >= 0 && days <= 60
      })
      .sort((a, b) => new Date(a.date_expires) - new Date(b.date_expires))
  )

  /** Movements with status 'Pending Return' older than 14 days. */
  const overdueMovements = computed(() =>
    movements.value.filter((m) => {
      if (m.status !== 'Pending Return') return false
      const daysSince = Math.floor(
        (new Date() - new Date(m.movement_date)) / (1000 * 60 * 60 * 24)
      )
      return daysSince > 14
    })
  )

  /** Buildings where bfp_ready = false. */
  const notReadyBuildings = computed(() =>
    compliances.value.filter((c) => !c.bfp_ready)
  )

  /**
   * Campus-wide totals.
   * Emergency lights live on fire_floor_compliance (per floor), not per building.
   */
  const campusTotals = computed(() => {
    let feOnSite = 0, feNeeded = 0, elOnSite = 0, elNeeded = 0
    for (const f of floorCompliances.value) {
      feOnSite += (f.fe_10lbs_on_site ?? 0) + (f.fe_5lbs_on_site ?? 0) + (f.fe_hcfc_on_site ?? 0)
      feNeeded += (f.fe_10lbs_needed  ?? 0) + (f.fe_5lbs_needed  ?? 0) + (f.fe_hcfc_needed  ?? 0)
      elOnSite += (f.emergency_lights_on_site ?? 0)
      elNeeded += (f.emergency_lights_needed  ?? 0)
    }
    return { feOnSite, feNeeded, elOnSite, elNeeded }
  })

  /**
   * Per-compliance_id gap totals — used on dashboard building list rows.
   * Returns: { [compliance_id]: { feGap, elGap } }
   */
  const gapByCompliance = computed(() => {
    const map = {}
    for (const f of floorCompliances.value) {
      if (!map[f.compliance_id]) map[f.compliance_id] = { feGap: 0, elGap: 0 }
      map[f.compliance_id].feGap +=
        Math.max(0, (f.fe_10lbs_needed ?? 0) - (f.fe_10lbs_on_site ?? 0)) +
        Math.max(0, (f.fe_5lbs_needed  ?? 0) - (f.fe_5lbs_on_site  ?? 0)) +
        Math.max(0, (f.fe_hcfc_needed  ?? 0) - (f.fe_hcfc_on_site  ?? 0))
      map[f.compliance_id].elGap +=
        Math.max(0, (f.emergency_lights_needed  ?? 0) - (f.emergency_lights_on_site ?? 0))
    }
    return map
  })

  // ─── Fetch Actions ────────────────────────────────────────────────────────

  /** Fetch all buildings (shared with electrical module). */
  async function fetchBuildings() {
    setLoading('buildings', true)
    clearError('buildings')
    try {
      const { data, error: e } = await supabase
        .from('building')
        .select('building_id, building_name, number_of_floors, college_or_department')
        .order('building_name', { ascending: true })
      if (e) throw e
      buildings.value = data ?? []
    } catch (err) {
      setError('buildings', err.message ?? 'Failed to load buildings.')
      console.error('[firesafety] fetchBuildings:', err)
    } finally {
      setLoading('buildings', false)
    }
  }

  /**
   * Fetch all fire_building_compliance + all fire_floor_compliance rows.
   * Called once on the dashboard (Screen A).
   */
  async function fetchCompliances() {
    setLoading('compliances', true)
    clearError('compliances')
    try {
      const [compRes, floorRes] = await Promise.all([
        supabase
          .from('fire_building_compliance')
          .select('*')
          .order('building_id', { ascending: true }),
        supabase
          .from('fire_floor_compliance')
          .select('*')
          .order('compliance_id', { ascending: true }),
      ])
      if (compRes.error)  throw compRes.error
      if (floorRes.error) throw floorRes.error

      compliances.value      = compRes.data  ?? []
      floorCompliances.value = floorRes.data ?? []
    } catch (err) {
      setError('compliances', err.message ?? 'Failed to load compliance data.')
      console.error('[firesafety] fetchCompliances:', err)
    } finally {
      setLoading('compliances', false)
    }
  }

  /**
   * Fetch full detail for ONE building (Screen B).
   * Loads compliance record → floor rows (via compliance_id) → unit rows.
   */
  async function fetchBuildingCompliance(buildingId) {
    setLoading('currentBuilding', true)
    clearError('currentBuilding')
    try {
      // 1. Get the fire_building_compliance row
      const { data: compData, error: compErr } = await supabase
        .from('fire_building_compliance')
        .select('*')
        .eq('building_id', buildingId)
        .maybeSingle()
      if (compErr) throw compErr

      // No compliance record yet — create one automatically
      if (!compData) {
        const { data: newComp, error: insertErr } = await supabase
          .from('fire_building_compliance')
          .insert({ building_id: buildingId, bfp_ready: false, last_updated_date: todayStr() })
          .select()
          .single()
        if (insertErr) throw insertErr
        currentCompliance.value = newComp
      } else {
        currentCompliance.value = compData
      }

      // 2. Get fire_floor_compliance rows via compliance_id
      const { data: floorData, error: floorErr } = await supabase
        .from('fire_floor_compliance')
        .select('*')
        .eq('compliance_id', compData.compliance_id)
        .order('floor_level', { ascending: true })
      if (floorErr) throw floorErr
      currentFloorCompliances.value = floorData ?? []

      // 3. Get fire_extinguisher_unit rows for this building
      const { data: unitData, error: unitErr } = await supabase
        .from('fire_extinguisher_unit')
        .select(`
          unit_id, building_id, floor_level, room_location,
          fe_size, installation_type, quantity_at_location,
          date_purchased_or_refilled, date_expires,
          supplier, warranty_years, current_condition, actions_needed,
          building:building_id ( building_id, building_name )
        `)
        .eq('building_id', buildingId)
        .order('floor_level', { ascending: true })
      if (unitErr) throw unitErr
      currentUnits.value = unitData ?? []
    } catch (err) {
      setError('currentBuilding', err.message ?? 'Failed to load building detail.')
      console.error('[firesafety] fetchBuildingCompliance:', err)
    } finally {
      setLoading('currentBuilding', false)
    }
  }

  /**
   * Fetch ALL fire_extinguisher_unit rows (Expiry Tracker — Screen C).
   * Sorted by soonest expiry first.
   */
  async function fetchAllUnits() {
    setLoading('units', true)
    clearError('units')
    try {
      const { data, error: e } = await supabase
        .from('fire_extinguisher_unit')
        .select(`
          unit_id, building_id, floor_level, room_location,
          fe_size, installation_type, quantity_at_location,
          date_purchased_or_refilled, date_expires,
          supplier, warranty_years, current_condition, actions_needed,
          building:building_id ( building_id, building_name )
        `)
        .order('date_expires', { ascending: true, nullsFirst: false })
      if (e) throw e
      units.value = data ?? []
    } catch (err) {
      setError('units', err.message ?? 'Failed to load extinguisher units.')
      console.error('[firesafety] fetchAllUnits:', err)
    } finally {
      setLoading('units', false)
    }
  }

  /**
   * Fetch ALL movement log entries (Screen D), newest first.
   */
  async function fetchMovements() {
    setLoading('movements', true)
    clearError('movements')
    try {
      const { data, error: e } = await supabase
        .from('fire_extinguisher_movement')
        .select(`
          movement_id, unit_id, from_building_id, from_floor, from_room,
          to_building_id, to_floor, to_room, to_supplier,
          movement_type, quantity_moved, movement_date,
          expected_return_date, status, notes,
          count_before, count_after,
          from_building:from_building_id ( building_name ),
          to_building:to_building_id ( building_name )
        `)
        .order('movement_date', { ascending: false })
      if (e) throw e
      movements.value = data ?? []
    } catch (err) {
      setError('movements', err.message ?? 'Failed to load movements.')
      console.error('[firesafety] fetchMovements:', err)
    } finally {
      setLoading('movements', false)
    }
  }

  // ─── Write Actions ────────────────────────────────────────────────────────

  /**
   * Toggle a boolean feature or update a count field on fire_building_compliance.
   * Saves instantly on every tap — no separate save button.
   * Writes to compliance_feature_log for audit trail.
   * Then recomputes bfp_ready automatically.
   */
  async function toggleComplianceFeature(buildingId, feature, newValue) {
    setLoading('saveCompliance', true)
    clearError('saveCompliance')
    try {
      const oldValue = currentCompliance.value?.[feature]

      const { data, error: e } = await supabase
        .from('fire_building_compliance')
        .update({ [feature]: newValue, last_updated_date: todayStr() })
        .eq('building_id', buildingId)
        .select()
        .single()
      if (e) throw e

      // Sync local state
      currentCompliance.value = { ...currentCompliance.value, ...data }
      const idx = compliances.value.findIndex((c) => c.building_id === buildingId)
      if (idx !== -1) compliances.value[idx] = { ...compliances.value[idx], ...data }

      // Write compliance feature log (non-blocking)
      supabase.from('compliance_feature_log').insert({
        building_id:  buildingId,
        feature_name: feature,
        old_value:    String(oldValue ?? ''),
        new_value:    String(newValue),
        changed_date: new Date().toISOString(),
        changed_by:   'Engineer',
      }).then(() => {}) // fire and forget

      // Auto-recompute BFP readiness
      await recomputeBFPReady(buildingId)
      return true
    } catch (err) {
      setError('saveCompliance', err.message ?? 'Failed to save feature.')
      console.error('[firesafety] toggleComplianceFeature:', err)
      return false
    } finally {
      setLoading('saveCompliance', false)
    }
  }

  /**
   * Update FE counts and/or emergency lights on a fire_floor_compliance row.
   * Primary key: floor_compliance_id.
   * After saving, recomputes BFP readiness.
   */
  async function updateFloorCompliance(floorComplianceId, fields) {
    setLoading('saveFloorFE', true)
    clearError('saveFloorFE')
    try {
      const { data, error: e } = await supabase
        .from('fire_floor_compliance')
        .update(fields)
        .eq('floor_compliance_id', floorComplianceId)
        .select()
        .single()
      if (e) throw e

      // Sync currentFloorCompliances
      const idx = currentFloorCompliances.value.findIndex(
        (f) => f.floor_compliance_id === floorComplianceId
      )
      if (idx !== -1) {
        currentFloorCompliances.value[idx] = {
          ...currentFloorCompliances.value[idx], ...data,
        }
      }

      // Sync global floorCompliances list
      const gIdx = floorCompliances.value.findIndex(
        (f) => f.floor_compliance_id === floorComplianceId
      )
      if (gIdx !== -1) {
        floorCompliances.value[gIdx] = { ...floorCompliances.value[gIdx], ...data }
      }

      // Recompute BFP readiness for the parent building
      if (currentCompliance.value) {
        await recomputeBFPReady(currentCompliance.value.building_id)
      }

      return data
    } catch (err) {
      setError('saveFloorFE', err.message ?? 'Failed to update floor counts.')
      console.error('[firesafety] updateFloorCompliance:', err)
      return null
    } finally {
      setLoading('saveFloorFE', false)
    }
  }

  /**
   * Update a fire extinguisher unit's condition.
   *
   * Valid conditions: 'FULL', 'EMPTY', 'DAMAGED', 'EXPIRED'
   * 'REFILLED' is NOT a valid DB value — when a unit is refilled:
   *   - condition is set to 'FULL'
   *   - date_purchased_or_refilled is updated
   *   - date_expires is auto-calculated (date + 2 years, never typed)
   *   - supplier and warranty_years are updated
   *
   * payload: {
   *   condition: 'FULL' | 'EMPTY' | 'DAMAGED' | 'EXPIRED'
   *   isRefill?: boolean         — true when logging a refill
   *   date_refilled?: string     — required if isRefill = true
   *   supplier?: string
   *   warranty_years?: 1 | 2
   * }
   */
  async function logCondition(unitId, payload) {
    setLoading('logCondition', true)
    clearError('logCondition')
    try {
      const updateData = {
        current_condition: payload.condition,  // must be FULL | EMPTY | DAMAGED | EXPIRED
      }

      // When logging a refill, condition = 'FULL' + update refill fields
      if (payload.isRefill) {
        updateData.current_condition           = 'FULL'
        updateData.date_purchased_or_refilled  = payload.date_refilled
        updateData.date_expires                = addTwoYears(payload.date_refilled)
        updateData.supplier                    = payload.supplier    ?? 'TRI J&A'
        updateData.warranty_years              = payload.warranty_years ?? 2
      }

      const { data, error: e } = await supabase
        .from('fire_extinguisher_unit')
        .update(updateData)
        .eq('unit_id', unitId)
        .select()
        .single()
      if (e) throw e

      // Sync both unit lists
      ;[units.value, currentUnits.value].forEach((list) => {
        const i = list.findIndex((u) => u.unit_id === unitId)
        if (i !== -1) list[i] = { ...list[i], ...data }
      })

      return data
    } catch (err) {
      setError('logCondition', err.message ?? 'Failed to update condition.')
      console.error('[firesafety] logCondition:', err)
      return null
    } finally {
      setLoading('logCondition', false)
    }
  }

  /**
   * Log a fire extinguisher movement.
   *
   * Required by DB schema:
   *   - unit_id: NOT NULL (must link to a real unit)
   *   - from_room: NOT NULL (cannot be empty string — use room location)
   *   - count_before: NOT NULL
   *   - count_after: NOT NULL
   *   - status: 'Complete' | 'Pending Return'
   *   - movement_type: 'Removed'|'Sent for Refill'|'Transferred'|'Returned'|'New Unit Added'
   *
   * payload.fe_size is a helper field (not stored in movement table).
   * It is used here to update fire_floor_compliance counts automatically.
   */
  async function logMovement(payload) {
    setLoading('logMovement', true)
    clearError('logMovement')
    try {
      const insertData = {
        unit_id:              payload.unit_id,           // required
        from_building_id:     payload.from_building_id,
        from_floor:           payload.from_floor,
        from_room:            payload.from_room,         // required, cannot be empty
        to_building_id:       payload.to_building_id    ?? null,
        to_floor:             payload.to_floor           ?? null,
        to_room:              payload.to_room            ?? null,
        to_supplier:          payload.to_supplier        ?? null,
        movement_type:        payload.movement_type,
        quantity_moved:       payload.quantity_moved     ?? 1,
        movement_date:        payload.movement_date      ?? todayStr(),
        expected_return_date: payload.expected_return_date ?? null,
        status:               payload.status,            // 'Complete' | 'Pending Return'
        notes:                payload.notes              ?? null,
        count_before:         payload.count_before,      // required
        count_after:          payload.count_after,       // required
      }

      const { data, error: e } = await supabase
        .from('fire_extinguisher_movement')
        .insert(insertData)
        .select(`
          movement_id, unit_id, from_building_id, from_floor, from_room,
          to_building_id, to_floor, to_room, to_supplier,
          movement_type, quantity_moved, movement_date,
          expected_return_date, status, notes,
          count_before, count_after,
          from_building:from_building_id ( building_name ),
          to_building:to_building_id ( building_name )
        `)
        .single()
      if (e) throw e

      // Prepend to local list (newest first)
      movements.value.unshift(data)

      // Auto-adjust fire_floor_compliance FE counts
      await applyMovementToFloorCounts(payload)

      return data
    } catch (err) {
      setError('logMovement', err.message ?? 'Failed to log movement.')
      console.error('[firesafety] logMovement:', err)
      return null
    } finally {
      setLoading('logMovement', false)
    }
  }

  /**
   * Adjust fire_floor_compliance on_site counts after a movement is logged.
   * payload.fe_size is passed from the form — it is NOT on the movement record.
   *
   * Removals (Removed, Sent for Refill, Transferred): decrease source floor
   * Additions (Returned, New Unit Added):              increase destination floor
   */
  async function applyMovementToFloorCounts(payload) {
    const removals  = ['Removed', 'Sent for Refill', 'Transferred']
    const additions = ['Returned', 'New Unit Added']
    const qty       = payload.quantity_moved ?? 1

    const sizeFieldMap = {
      '5lbs':  'fe_5lbs_on_site',
      '10lbs': 'fe_10lbs_on_site',
      'HCFC':  'fe_hcfc_on_site',
    }
    const sizeField = sizeFieldMap[payload.fe_size]
    if (!sizeField) return

    // Decrease source floor
    if (removals.includes(payload.movement_type) && payload.from_building_id && payload.from_floor) {
      const sourceComp = compliances.value.find((c) => c.building_id === payload.from_building_id)
      if (sourceComp) {
        const floor = floorCompliances.value.find(
          (f) =>
            f.compliance_id === sourceComp.compliance_id &&
            f.floor_level   === payload.from_floor
        )
        if (floor) {
          const newVal = Math.max(0, (floor[sizeField] ?? 0) - qty)
          await updateFloorCompliance(floor.floor_compliance_id, { [sizeField]: newVal })
        }
      }
    }

    // Increase destination floor
    if (additions.includes(payload.movement_type) && payload.to_building_id && payload.to_floor) {
      const destComp = compliances.value.find((c) => c.building_id === payload.to_building_id)
      if (destComp) {
        const floor = floorCompliances.value.find(
          (f) =>
            f.compliance_id === destComp.compliance_id &&
            f.floor_level   === payload.to_floor
        )
        if (floor) {
          const newVal = (floor[sizeField] ?? 0) + qty
          await updateFloorCompliance(floor.floor_compliance_id, { [sizeField]: newVal })
        }
      }
    }
  }

  /**
   * Auto-recompute bfp_ready for a building.
   * Rule per spec: ✓ ONLY when:
   *   - All floor FE gaps = 0 (on_site >= needed for all sizes, all floors)
   *   - All floor EL gaps = 0 (emergency_lights_on_site >= needed, all floors)
   *   - All binary features = true
   * No manual override — always computed automatically.
   */
  async function recomputeBFPReady(buildingId) {
    const compliance = compliances.value.find((c) => c.building_id === buildingId)
      ?? currentCompliance.value
    if (!compliance) return

    const floors = floorCompliances.value.filter(
      (f) => f.compliance_id === compliance.compliance_id
    )

    const feGapZero = floors.every(
      (f) =>
        (f.fe_10lbs_on_site ?? 0) >= (f.fe_10lbs_needed ?? 0) &&
        (f.fe_5lbs_on_site  ?? 0) >= (f.fe_5lbs_needed  ?? 0) &&
        (f.fe_hcfc_on_site  ?? 0) >= (f.fe_hcfc_needed  ?? 0)
    )

    const elGapZero = floors.every(
      (f) => (f.emergency_lights_on_site ?? 0) >= (f.emergency_lights_needed ?? 0)
    )

    const binaryOk =
      !!compliance.fire_hose_cabinet &&
      !!compliance.exit_right        &&
      !!compliance.exit_left         &&
      !!compliance.exit_sign         &&
      !!compliance.sprinkler_system  &&
      !!compliance.smoke_detector

    const newReady = feGapZero && elGapZero && binaryOk

    // Only write to DB if the value actually changed
    if (newReady !== compliance.bfp_ready) {
      const { error: e } = await supabase
        .from('fire_building_compliance')
        .update({ bfp_ready: newReady, last_updated_date: todayStr() })
        .eq('building_id', buildingId)

      if (!e) {
        const idx = compliances.value.findIndex((c) => c.building_id === buildingId)
        if (idx !== -1) compliances.value[idx].bfp_ready = newReady
        if (currentCompliance.value?.building_id === buildingId) {
          currentCompliance.value.bfp_ready = newReady
        }
      }
    }
  }

  // ─── Helper functions exposed to views ────────────────────────────────────

  /**
   * Human-readable expiry label for unit cards.
   * e.g. "12 days left" | "Expired 5 days ago" | "Expires today"
   */
  function getDaysLabel(expiryDateStr) {
    const days = daysUntilExpiry(expiryDateStr)
    if (days === null) return '—'
    if (days < 0)   return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
    if (days === 0) return 'Expires today'
    return `${days} day${days === 1 ? '' : 's'} left`
  }

  /**
   * CSS class string for expiry status badges.
   * 'expiry--expired' | 'expiry--soon' | 'expiry--ok'
   */
  function getExpiryClass(expiryDateStr) {
    const days = daysUntilExpiry(expiryDateStr)
    if (days === null) return ''
    if (days < 0)   return 'expiry--expired'
    if (days <= 60) return 'expiry--soon'
    return 'expiry--ok'
  }

  /**
   * Compute and display the new expiry date for the refill preview card.
   * Always exactly 2 years from the given date. Never typed by user.
   */
  function computeNewExpiry(dateStr) {
    return addTwoYears(dateStr)
  }

  /**
   * Manually set bfp_ready for a building.
   * User-controlled — bypasses auto-recompute logic.
   */
  async function setBFPReady(buildingId, isReady) {
    setLoading('saveCompliance', true)
    clearError('saveCompliance')
    try {
      const { data, error: e } = await supabase
        .from('fire_building_compliance')
        .update({ bfp_ready: isReady, last_updated_date: todayStr() })
        .eq('building_id', buildingId)
        .select()
        .single()
      if (e) throw e

      currentCompliance.value = { ...currentCompliance.value, ...data }
      const idx = compliances.value.findIndex((c) => c.building_id === buildingId)
      if (idx !== -1) compliances.value[idx] = { ...compliances.value[idx], ...data }

      supabase.from('compliance_feature_log').insert({
        building_id:  buildingId,
        feature_name: 'bfp_ready',
        old_value:    String(!isReady),
        new_value:    String(isReady),
        changed_date: new Date().toISOString(),
        changed_by:   'Engineer',
      }).then(() => {})

      return true
    } catch (err) {
      setError('saveCompliance', err.message ?? 'Failed to update BFP status.')
      console.error('[firesafety] setBFPReady:', err)
      return false
    } finally {
      setLoading('saveCompliance', false)
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  function $reset() {
    buildings.value               = []
    compliances.value             = []
    floorCompliances.value        = []
    units.value                   = []
    movements.value               = []
    currentCompliance.value       = null
    currentFloorCompliances.value = []
    currentUnits.value            = []
    Object.keys(loading.value).forEach((k) => (loading.value[k] = false))
    Object.keys(error.value).forEach((k)   => (error.value[k]   = null))
  }

  return {
    // state
    buildings,
    compliances,
    floorCompliances,
    units,
    movements,
    currentCompliance,
    currentFloorCompliances,
    currentUnits,
    loading,
    error,
    // getters
    expiredUnits,
    expiringSoonUnits,
    overdueMovements,
    notReadyBuildings,
    campusTotals,
    gapByCompliance,
    // actions
    fetchBuildings,
    fetchCompliances,
    fetchBuildingCompliance,
    fetchAllUnits,
    fetchMovements,
    toggleComplianceFeature,
    updateFloorCompliance,
    logCondition,
    logMovement,
    setBFPReady,
    // helpers
    getDaysLabel,
    getExpiryClass,
    computeNewExpiry,
    daysUntilExpiry,
    $reset,
  }
})
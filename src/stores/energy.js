import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

/**
 * ─── SCHEMA REFERENCE ────────────────────────────────────────────────────────
 *
 * energy_meter
 *   meter_id, meter_number (smallint, unique), area_name,
 *   multiplier (int, default 1), is_active (bool), notes
 *
 * meter_reading_session
 *   session_id, period_type CHECK IN ('Monthly','Working Days','Non-Working Days'),
 *   date_from, date_to, total_kwh (decimal, default 0),
 *   status CHECK IN ('Draft','Complete'),
 *   created_date, created_by, notes
 *
 * meter_reading_entry
 *   entry_id, session_id, meter_id,
 *   previous_reading (decimal), present_reading (decimal),
 *   raw_consumption (decimal, nullable),  -- present - previous
 *   actual_kwh (decimal, nullable),       -- raw_consumption × multiplier
 *   has_warning (bool, default false),
 *   warning_note (varchar, nullable)
 *   UNIQUE (session_id, meter_id)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const useEnergyStore = defineStore('energy', () => {
  // ─── State ────────────────────────────────────────────────────────────────
  const meters    = ref([])   // all energy_meter rows
  const sessions  = ref([])   // all meter_reading_session rows (for history)
  const entries   = ref([])   // meter_reading_entry rows for the current session

  // Current active / draft session
  const currentSession = ref(null)

  // Latest complete session per period type (for EnergyHome comparison)
  const latestMonthly       = ref(null)
  const latestWorkingDays   = ref(null)
  const latestNonWorkingDays = ref(null)

  const loading = ref({
    meters:         false,
    sessions:       false,
    entries:        false,
    currentSession: false,
    saveSession:    false,
    saveEntry:      false,
    completeSession: false,
  })

  const error = ref({
    meters:         null,
    sessions:       null,
    entries:        null,
    currentSession: null,
    saveSession:    null,
    saveEntry:      null,
    completeSession: null,
  })

  // ─── Internal helpers ─────────────────────────────────────────────────────
  function setLoading(k, v) { loading.value[k] = v }
  function setError(k, v)   { error.value[k]   = v }
  function clearError(k)    { error.value[k]   = null }

//   const todayStr = () => new Date().toISOString().split('T')[0]

  /**
   * Compute raw_consumption and actual_kwh for a given entry + multiplier.
   * raw_consumption = present_reading - previous_reading
   * actual_kwh      = raw_consumption × multiplier
   */
  function computeConsumption(previousReading, presentReading, multiplier) {
    const prev = parseFloat(previousReading) || 0
    const pres = parseFloat(presentReading)  || 0
    const mult = parseInt(multiplier)        || 1
    const raw  = pres - prev
    const kwh  = raw * mult
    return {
      raw_consumption: parseFloat(raw.toFixed(2)),
      actual_kwh:      parseFloat(kwh.toFixed(2)),
    }
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** Only active meters, sorted by meter_number ascending. */
  const activeMeters = computed(() =>
    meters.value
      .filter((m) => m.is_active)
      .sort((a, b) => a.meter_number - b.meter_number)
  )

  /** Total campus kWh for the current session (sum of all actual_kwh entries). */
  const sessionTotalKwh = computed(() =>
    entries.value.reduce((sum, e) => sum + (parseFloat(e.actual_kwh) || 0), 0)
  )

  /** Count of entries that have a present_reading entered in the current session. */
  const enteredCount = computed(() =>
    entries.value.filter((e) => e.present_reading !== null && e.present_reading !== '').length
  )

  /** Count of active meters (target for progress indicator). */
  const totalMeterCount = computed(() => activeMeters.value.length)

  /** Entries that have a warning flag. */
  const warningEntries = computed(() =>
    entries.value.filter((e) => e.has_warning)
  )

  /**
   * Meters with zero actual_kwh that had consumption in a previous session.
   * Used for the "0 kWh — check meter" amber warning on EnergyHome.
   */
  const zeroConsumptionWarnings = computed(() =>
    entries.value.filter(
      (e) => parseFloat(e.actual_kwh) === 0 && parseFloat(e.previous_reading) > 0
    )
  )

  // ─── Fetch Actions ────────────────────────────────────────────────────────

  /**
   * Fetch all energy_meter rows.
   * Called once on mount — meters rarely change.
   */
  async function fetchMeters() {
    setLoading('meters', true)
    clearError('meters')
    try {
      const { data, error: e } = await supabase
        .from('energy_meter')
        .select('meter_id, meter_number, area_name, multiplier, is_active, notes')
        .order('meter_number', { ascending: true })
      if (e) throw e
      meters.value = data ?? []
    } catch (err) {
      setError('meters', err.message ?? 'Failed to load meters.')
      console.error('[energy] fetchMeters:', err)
    } finally {
      setLoading('meters', false)
    }
  }

  /**
   * Fetch all meter_reading_session rows for the history / report screen.
   * Ordered newest first.
   */
  async function fetchSessions() {
    setLoading('sessions', true)
    clearError('sessions')
    try {
      const { data, error: e } = await supabase
        .from('meter_reading_session')
        .select('session_id, period_type, date_from, date_to, total_kwh, status, created_date, created_by, notes')
        .order('date_from', { ascending: false })
      if (e) throw e
      sessions.value = data ?? []
    } catch (err) {
      setError('sessions', err.message ?? 'Failed to load sessions.')
      console.error('[energy] fetchSessions:', err)
    } finally {
      setLoading('sessions', false)
    }
  }

  /**
   * Fetch the latest complete session for each period type.
   * Used by EnergyHome for period-over-period comparison.
   */
  async function fetchLatestSessions() {
    try {
      const types = ['Monthly', 'Working Days', 'Non-Working Days']
      const results = await Promise.all(
        types.map((type) =>
          supabase
            .from('meter_reading_session')
            .select('session_id, period_type, date_from, date_to, total_kwh, status')
            .eq('period_type', type)
            .eq('status', 'Complete')
            .order('date_from', { ascending: false })
            .limit(2)   // latest + previous for comparison
        )
      )

      latestMonthly.value        = results[0].data ?? []
      latestWorkingDays.value    = results[1].data ?? []
      latestNonWorkingDays.value = results[2].data ?? []
    } catch (err) {
      console.error('[energy] fetchLatestSessions:', err)
    }
  }

  /**
   * Fetch all entries for a specific session.
   * Joins meter info so we have area_name and multiplier.
   */
  async function fetchEntriesBySession(sessionId) {
    setLoading('entries', true)
    clearError('entries')
    try {
      const { data, error: e } = await supabase
        .from('meter_reading_entry')
        .select(`
          entry_id, session_id, meter_id,
          previous_reading, present_reading,
          raw_consumption, actual_kwh,
          has_warning, warning_note,
          meter:meter_id (
            meter_id, meter_number, area_name, multiplier, is_active
          )
        `)
        .eq('session_id', sessionId)
        .order('meter_id', { ascending: true })
      if (e) throw e
      entries.value = data ?? []
    } catch (err) {
      setError('entries', err.message ?? 'Failed to load entries.')
      console.error('[energy] fetchEntriesBySession:', err)
    } finally {
      setLoading('entries', false)
    }
  }

  /**
   * Fetch or resume a Draft session.
   * If a Draft session exists for the given period_type, loads it.
   * Returns the session or null.
   */
  async function fetchDraftSession(periodType) {
    setLoading('currentSession', true)
    clearError('currentSession')
    try {
      const { data, error: e } = await supabase
        .from('meter_reading_session')
        .select('*')
        .eq('period_type', periodType)
        .eq('status', 'Draft')
        .order('created_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (e) throw e
      currentSession.value = data ?? null
      if (data) await fetchEntriesBySession(data.session_id)
      return data
    } catch (err) {
      setError('currentSession', err.message ?? 'Failed to load draft session.')
      console.error('[energy] fetchDraftSession:', err)
      return null
    } finally {
      setLoading('currentSession', false)
    }
  }

  /**
   * Get the most recent previous reading for each meter.
   * Used to auto-fill previous_reading when starting a new session.
   * Returns a map: meter_id → previous_reading value
   */
  async function fetchPreviousReadings() {
    try {
      // Get the most recent Complete session entries per meter
      const { data, error: e } = await supabase
        .from('meter_reading_entry')
        .select(`
          meter_id, present_reading,
          meter_reading_session!inner (status, date_to)
        `)
        .eq('meter_reading_session.status', 'Complete')
        .order('meter_reading_session.date_to', { ascending: false })

      if (e) throw e

      // Build map: meter_id → latest present_reading (as the new previous_reading)
      const map = {}
      for (const entry of (data ?? [])) {
        if (!map[entry.meter_id]) {
          map[entry.meter_id] = parseFloat(entry.present_reading) || 0
        }
      }
      return map
    } catch (err) {
      console.error('[energy] fetchPreviousReadings:', err)
      return {}
    }
  }

  // ─── Write Actions ────────────────────────────────────────────────────────

  /**
   * Create a new meter_reading_session (status: 'Draft').
   * Also creates empty meter_reading_entry rows for all active meters
   * with previous_reading auto-filled from the last complete session.
   */
  async function createSession(payload) {
    setLoading('saveSession', true)
    clearError('saveSession')
    try {
      // 1. Create the session
      const { data: sessionData, error: sessionErr } = await supabase
        .from('meter_reading_session')
        .insert({
          period_type:  payload.period_type,
          date_from:    payload.date_from,
          date_to:      payload.date_to,
          total_kwh:    0,
          status:       'Draft',
          created_date: new Date().toISOString(),
          created_by:   'Engineer',
          notes:        payload.notes ?? null,
        })
        .select()
        .single()

      if (sessionErr) throw sessionErr
      currentSession.value = sessionData

      // 2. Get previous readings for all meters
      const prevReadings = await fetchPreviousReadings()

      // 3. Create empty entry rows for each active meter
      const entryRows = activeMeters.value.map((meter) => ({
        session_id:       sessionData.session_id,
        meter_id:         meter.meter_id,
        previous_reading: prevReadings[meter.meter_id] ?? 0,
        present_reading:  0,
        raw_consumption:  null,
        actual_kwh:       null,
        has_warning:      false,
        warning_note:     null,
      }))

      const { error: entryErr } = await supabase
        .from('meter_reading_entry')
        .insert(entryRows)

      if (entryErr) throw entryErr

      // 4. Load the newly created entries
      await fetchEntriesBySession(sessionData.session_id)

      return sessionData
    } catch (err) {
      setError('saveSession', err.message ?? 'Failed to create session.')
      console.error('[energy] createSession:', err)
      return null
    } finally {
      setLoading('saveSession', false)
    }
  }

  /**
   * Save a single meter reading entry.
   * Computes raw_consumption and actual_kwh automatically.
   * Sets has_warning = true if present_reading < previous_reading.
   */
  async function saveEntry(entryId, meterId, presentReading, previousReading, multiplier) {
    setLoading('saveEntry', true)
    clearError('saveEntry')
    try {
      const prev    = parseFloat(previousReading) || 0
      const pres    = parseFloat(presentReading)  || 0
      const isLower = pres < prev

      const { raw_consumption, actual_kwh } = computeConsumption(prev, pres, multiplier)

      const updateData = {
        present_reading: pres,
        raw_consumption,
        actual_kwh,
        has_warning:  isLower,
        warning_note: isLower
          ? `Present reading (${pres}) is lower than previous reading (${prev}). Please verify.`
          : null,
      }

      const { data, error: e } = await supabase
        .from('meter_reading_entry')
        .update(updateData)
        .eq('entry_id', entryId)
        .select()
        .single()

      if (e) throw e

      // Sync local entries list
      const idx = entries.value.findIndex((en) => en.entry_id === entryId)
      if (idx !== -1) entries.value[idx] = { ...entries.value[idx], ...data }

      // Update session total_kwh
      await updateSessionTotal()

      return data
    } catch (err) {
      setError('saveEntry', err.message ?? 'Failed to save entry.')
      console.error('[energy] saveEntry:', err)
      return null
    } finally {
      setLoading('saveEntry', false)
    }
  }

  /**
   * Save ALL entries at once (batch save — "Save All Readings" button).
   * Takes an array of { entry_id, meter_id, present_reading, previous_reading, multiplier }.
   */
  async function saveAllEntries(entryPayloads) {
    setLoading('saveEntry', true)
    clearError('saveEntry')
    try {
      const updates = entryPayloads.map((ep) => {
        const prev    = parseFloat(ep.previous_reading) || 0
        const pres    = parseFloat(ep.present_reading)  || 0
        const isLower = pres < prev
        const { raw_consumption, actual_kwh } = computeConsumption(prev, pres, ep.multiplier)

        return {
          entry_id:        ep.entry_id,
          present_reading: pres,
          raw_consumption,
          actual_kwh,
          has_warning:     isLower,
          warning_note:    isLower
            ? `Present reading (${pres}) is lower than previous reading (${prev}). Please verify.`
            : null,
        }
      })

      // Supabase upsert using entry_id as the match key
      const { data, error: e } = await supabase
        .from('meter_reading_entry')
        .upsert(updates, { onConflict: 'entry_id' })
        .select()

      if (e) throw e

      // Sync local entries
      for (const updated of (data ?? [])) {
        const idx = entries.value.findIndex((en) => en.entry_id === updated.entry_id)
        if (idx !== -1) entries.value[idx] = { ...entries.value[idx], ...updated }
      }

      await updateSessionTotal()
      return data
    } catch (err) {
      setError('saveEntry', err.message ?? 'Failed to save readings.')
      console.error('[energy] saveAllEntries:', err)
      return null
    } finally {
      setLoading('saveEntry', false)
    }
  }

  /**
   * Mark a session as Complete.
   * Blocked if any active meter has no entry (present_reading = 0 with no prior).
   * Updates total_kwh on the session before completing.
   */
  async function completeSession(sessionId) {
    setLoading('completeSession', true)
    clearError('completeSession')
    try {
      // Compute total from entries
      const total = entries.value.reduce(
        (sum, e) => sum + (parseFloat(e.actual_kwh) || 0), 0
      )

      const { data, error: e } = await supabase
        .from('meter_reading_session')
        .update({
          status:    'Complete',
          total_kwh: parseFloat(total.toFixed(2)),
        })
        .eq('session_id', sessionId)
        .select()
        .single()

      if (e) throw e

      currentSession.value = data

      // Add to sessions list if not already there
      const idx = sessions.value.findIndex((s) => s.session_id === sessionId)
      if (idx !== -1) sessions.value[idx] = { ...sessions.value[idx], ...data }
      else sessions.value.unshift(data)

      return data
    } catch (err) {
      setError('completeSession', err.message ?? 'Failed to complete session.')
      console.error('[energy] completeSession:', err)
      return null
    } finally {
      setLoading('completeSession', false)
    }
  }

  /**
   * Recompute and update total_kwh on the current session.
   * Called automatically after every entry save.
   */
  async function updateSessionTotal() {
    if (!currentSession.value) return
    const total = entries.value.reduce(
      (sum, e) => sum + (parseFloat(e.actual_kwh) || 0), 0
    )
    const rounded = parseFloat(total.toFixed(2))

    await supabase
      .from('meter_reading_session')
      .update({ total_kwh: rounded })
      .eq('session_id', currentSession.value.session_id)

    if (currentSession.value) currentSession.value.total_kwh = rounded
  }

  /**
   * Missing meters check — returns area names of meters with no entry
   * or zero present_reading in the current session.
   * Used to block report generation if any are missing.
   */
  function getMissingMeters() {
    return activeMeters.value
      .filter((meter) => {
        const entry = entries.value.find((e) => e.meter_id === meter.meter_id)
        return !entry || (parseFloat(entry.present_reading) === 0 && parseFloat(entry.previous_reading) === 0)
      })
      .map((m) => m.area_name)
  }

  /**
   * Fetch entries for a session and return raw data (without setting store state).
   * Used by EnergyHome to display meter list for the current period.
   */
  async function fetchEntriesBySessionRaw(sessionId) {
    try {
      const { data, error: e } = await supabase
        .from('meter_reading_entry')
        .select(`
          entry_id, session_id, meter_id,
          previous_reading, present_reading,
          raw_consumption, actual_kwh,
          has_warning, warning_note,
          meter:meter_id (
            meter_id, meter_number, area_name, multiplier, is_active
          )
        `)
        .eq('session_id', sessionId)
        .order('meter_id', { ascending: true })
      if (e) throw e
      return { data: data ?? [] }
    } catch (err) {
      console.error('[energy] fetchEntriesBySessionRaw:', err)
      return { data: [] }
    }
  }

  // ─── Comparison helpers (EnergyHome) ────────────────────────────────────

  /**
   * Period-over-period comparison for EnergyHome.
   * Returns { current, previous, percentChange, direction }
   * direction: 'up' | 'down' | 'same'
   */
  function getPeriodComparison(periodType) {
    const map = {
      'Monthly':           latestMonthly.value,
      'Working Days':      latestWorkingDays.value,
      'Non-Working Days':  latestNonWorkingDays.value,
    }
    const list = map[periodType] ?? []
    if (list.length < 2) return null

    const current  = parseFloat(list[0].total_kwh) || 0
    const previous = parseFloat(list[1].total_kwh) || 0
    if (previous === 0) return null

    const pct = ((current - previous) / previous) * 100
    return {
      current,
      previous,
      percentChange: Math.abs(pct).toFixed(1),
      direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same',
    }
  }

  /**
   * Working vs Non-Working comparison for EnergyHome and reports.
   * Returns plain-text insight sentence plus the raw numbers.
   */
  function getWorkingVsNonWorking() {
    const wSessions  = latestWorkingDays.value    ?? []
    const nwSessions = latestNonWorkingDays.value  ?? []

    if (!wSessions.length || !nwSessions.length) return null

    const wSession  = wSessions[0]
    const nwSession = nwSessions[0]

    const wKwh  = parseFloat(wSession.total_kwh)  || 0
    const nwKwh = parseFloat(nwSession.total_kwh) || 0

    // Calculate number of days for each period
    const wDays  = daysBetween(wSession.date_from,  wSession.date_to)
    const nwDays = daysBetween(nwSession.date_from, nwSession.date_to)

    const wDaily  = wDays  > 0 ? wKwh  / wDays  : 0
    const nwDaily = nwDays > 0 ? nwKwh / nwDays : 0

    const ratio = wDaily > 0 && nwDaily > 0
      ? (nwDaily / wDaily).toFixed(1)
      : null

    const insight = ratio
      ? `Non-working days used ${ratio}× ${parseFloat(ratio) > 1 ? 'more' : 'less'} electricity per day than working days.`
      : 'Not enough data for working vs. non-working comparison.'

    return {
      workingKwh:      wKwh,
      workingDays:     wDays,
      workingDaily:    wDaily.toFixed(2),
      nonWorkingKwh:   nwKwh,
      nonWorkingDays:  nwDays,
      nonWorkingDaily: nwDaily.toFixed(2),
      insight,
    }
  }

  function daysBetween(dateFrom, dateTo) {
    const diff = new Date(dateTo) - new Date(dateFrom)
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1)
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  function $reset() {
    meters.value             = []
    sessions.value           = []
    entries.value            = []
    currentSession.value     = null
    latestMonthly.value      = null
    latestWorkingDays.value  = null
    latestNonWorkingDays.value = null
    Object.keys(loading.value).forEach((k) => (loading.value[k] = false))
    Object.keys(error.value).forEach((k)   => (error.value[k]   = null))
  }

  return {
    // state
    meters,
    sessions,
    entries,
    currentSession,
    latestMonthly,
    latestWorkingDays,
    latestNonWorkingDays,
    loading,
    error,
    // getters
    activeMeters,
    sessionTotalKwh,
    enteredCount,
    totalMeterCount,
    warningEntries,
    zeroConsumptionWarnings,
    // actions
    fetchMeters,
    fetchSessions,
    fetchLatestSessions,
    fetchEntriesBySession,
    fetchDraftSession,
    fetchPreviousReadings,
    createSession,
    saveEntry,
    saveAllEntries,
    completeSession,
    updateSessionTotal,
    getMissingMeters,
    fetchEntriesBySessionRaw,
    // comparison helpers
    getPeriodComparison,
    getWorkingVsNonWorking,
    computeConsumption,
    $reset,
  }
})
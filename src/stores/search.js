import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const RECENT_KEY     = 'faciltrack_recent_searches'
const MAX_RECENT     = 5
const DEBOUNCE_MS    = 400

export const useSearchStore = defineStore('search', () => {
  // ── State ────────────────────────────────────────────────────────────────
  const isOpen      = ref(false)
  const query       = ref('')
  const isSearching = ref(false)
  const hasSearched = ref(false)
  const error       = ref('')

  const results = ref({
    buildings: [],
    rooms:     [],
    requests:  [],
    feUnits:   [],
  })

  const recentSearches = ref(loadRecent())

  // ── Debounce timer ───────────────────────────────────────────────────────
  let debounceTimer = null

  // ── Open / Close ─────────────────────────────────────────────────────────
  function openSearch() {
    isOpen.value = true
  }

  function closeSearch() {
    isOpen.value    = false
    query.value     = ''
    hasSearched.value = false
    error.value     = ''
    results.value   = { buildings: [], rooms: [], requests: [], feUnits: [] }
    clearTimeout(debounceTimer)
  }

  // ── Query input (debounced) ───────────────────────────────────────────────
  function onQueryInput(val) {
    query.value = val
    clearTimeout(debounceTimer)
    if (!val.trim()) {
      isSearching.value = false
      hasSearched.value = false
      results.value = { buildings: [], rooms: [], requests: [], feUnits: [] }
      return
    }
    isSearching.value = true
    debounceTimer = setTimeout(() => runSearch(val.trim()), DEBOUNCE_MS)
  }

  // ── Core search ───────────────────────────────────────────────────────────
  async function runSearch(term) {
    error.value = ''
    try {
      const pattern = `%${term}%`

      const [buildingsRes, roomsRes, requestsRes, feRes] = await Promise.all([
        // Buildings
        supabase
          .from('building')
          .select('building_id, building_name, college_or_department')
          .ilike('building_name', pattern)
          .limit(10),

        // Rooms
        supabase
          .from('room')
          .select('room_id, room_number, room_name, floor_level, building_id')
          .or(`room_number.ilike.${pattern},room_name.ilike.${pattern}`)
          .limit(10),

        // Repair requests
        supabase
          .from('repair_request')
          .select(`
            request_id, problem_description, status,
            room:room_id ( room_id, room_number, room_name, building_id )
          `)
          .ilike('problem_description', pattern)
          .limit(10),

        // Fire extinguisher units
        supabase
          .from('fire_extinguisher_movement')
          .select('movement_id, fe_code, supplier_name, fe_type')
          .or(`fe_code.ilike.${pattern},supplier_name.ilike.${pattern},fe_type.ilike.${pattern}`)
          .limit(10),
      ])

      results.value = {
        buildings: (buildingsRes.data ?? []).map((b) => ({
          id:       b.building_id,
          label:    b.building_name,
          sublabel: b.college_or_department ?? '',
          route:    { name: 'BuildingView', params: { id: b.building_id } },
        })),

        rooms: (roomsRes.data ?? []).map((r) => ({
          id:       r.room_id,
          label:    `${r.room_number} — ${r.room_name}`,
          sublabel: r.floor_level,
          route:    { name: 'RoomDetail', params: { id: r.building_id, roomId: r.room_id } },
        })),

        requests: (requestsRes.data ?? []).map((r) => ({
          id:       r.request_id,
          label:    r.problem_description,
          sublabel: r.room ? `${r.room.room_number} · ${r.status}` : r.status,
          route:    { name: 'RoomDetail', params: { id: r.room?.building_id, roomId: r.room?.room_id } },
        })),

        feUnits: (feRes.data ?? []).map((f) => ({
          id:       f.movement_id,
          label:    f.fe_code,
          sublabel: [f.fe_type, f.supplier_name].filter(Boolean).join(' · '),
          route:    { name: 'MovementLog' },
        })),
      }

      hasSearched.value = true
      saveRecent(term)
    } catch (err) {
      error.value = 'Search failed. Please try again.'
      console.error('[search] runSearch:', err)
    } finally {
      isSearching.value = false
    }
  }

  // ── Total results count ───────────────────────────────────────────────────
  function totalResults() {
    return (
      results.value.buildings.length +
      results.value.rooms.length +
      results.value.requests.length +
      results.value.feUnits.length
    )
  }

  // ── Recent searches ───────────────────────────────────────────────────────
  function loadRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    } catch {
      return []
    }
  }

  function saveRecent(term) {
    const list = [term, ...recentSearches.value.filter((t) => t !== term)].slice(0, MAX_RECENT)
    recentSearches.value = list
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  }

  function removeRecent(term) {
    recentSearches.value = recentSearches.value.filter((t) => t !== term)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentSearches.value))
  }

  function selectRecent(term) {
    query.value = term
    onQueryInput(term)
  }

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    isOpen, query, isSearching, hasSearched, error,
    results, recentSearches,
    openSearch, closeSearch,
    onQueryInput, totalResults,
    removeRecent, selectRecent,
  }
})
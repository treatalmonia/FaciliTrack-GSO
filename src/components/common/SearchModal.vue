<template>
  <Teleport to="body">
    <Transition name="search-modal">
      <div v-if="store.isOpen" class="search-overlay">
        <div class="search-panel">

          <!-- Input row -->
          <div class="search-input-row">
            <span class="search-input-row__icon">🔍</span>
            <input
              ref="inputRef"
              v-model="localQuery"
              type="search"
              inputmode="search"
              class="search-input"
              placeholder="Search buildings, rooms, or items..."
              autocomplete="off"
              @input="store.onQueryInput(localQuery)"
              @keydown.escape="store.closeSearch()"
            />
            <button class="cancel-btn" @click="store.closeSearch()">Cancel</button>
          </div>

          <!-- Body -->
          <div class="search-body">

            <!-- Searching -->
            <div v-if="store.isSearching" class="searching-state">
              <div class="spinner" />
              <span>Searching…</span>
            </div>

            <!-- Error -->
            <div v-else-if="store.error" class="error-banner">
              {{ store.error }}
            </div>

            <!-- Empty input — show hints + recent -->
            <template v-else-if="!localQuery.trim()">

              <!-- Hints -->
              <div class="hints-block">
                <p class="hints-block__title">Try searching for:</p>
                <ul class="hints-list">
                  <li><strong>A building name</strong> (e.g., Kinaadman Hall)</li>
                  <li><strong>A room number</strong> (e.g., KH 105)</li>
                  <li><strong>An item</strong> (e.g., LED tube, fire extinguisher)</li>
                </ul>
              </div>

              <!-- Recent searches -->
              <div v-if="store.recentSearches.length" class="recent-block">
                <div class="recent-block__header">
                  <p class="block-label">RECENT SEARCHES</p>
                </div>
                <div class="recent-pills">
                  <div
                    v-for="term in store.recentSearches"
                    :key="term"
                    class="recent-pill"
                  >
                    <button
                      class="recent-pill__term"
                      @click="selectRecent(term)"
                    >{{ term }}</button>
                    <button
                      class="recent-pill__remove"
                      @click="store.removeRecent(term)"
                      aria-label="Remove"
                    >×</button>
                  </div>
                </div>
              </div>

            </template>

            <!-- No results -->
            <div
              v-else-if="store.hasSearched && store.totalResults() === 0"
              class="no-results"
            >
              <p class="no-results__title">No results found for "{{ localQuery }}"</p>
              <p class="no-results__sub">
                Try a different keyword — a room number, building name, or problem description.
              </p>
            </div>

            <!-- Results -->
            <template v-else-if="store.hasSearched">

              <!-- Buildings -->
              <div v-if="store.results.buildings.length" class="result-group">
                <p class="block-label">BUILDINGS ({{ store.results.buildings.length }} FOUND)</p>
                <div class="result-list">
                  <button
                    v-for="item in store.results.buildings"
                    :key="item.id"
                    class="result-row"
                    @click="navigateTo(item)"
                  >
                    <div class="result-row__text">
                      <span class="result-row__label">{{ item.label }}</span>
                      <span v-if="item.sublabel" class="result-row__sub">{{ item.sublabel }}</span>
                    </div>
                    <span class="result-row__arrow">›</span>
                  </button>
                </div>
              </div>

              <!-- Rooms -->
              <div v-if="store.results.rooms.length" class="result-group">
                <p class="block-label">ROOMS ({{ store.results.rooms.length }} FOUND)</p>
                <div class="result-list">
                  <button
                    v-for="item in store.results.rooms"
                    :key="item.id"
                    class="result-row"
                    @click="navigateTo(item)"
                  >
                    <div class="result-row__text">
                      <span class="result-row__label">{{ item.label }}</span>
                      <span v-if="item.sublabel" class="result-row__sub">{{ item.sublabel }}</span>
                    </div>
                    <span class="result-row__arrow">›</span>
                  </button>
                </div>
              </div>

              <!-- Repair Requests -->
              <div v-if="store.results.requests.length" class="result-group">
                <p class="block-label">REPAIR REQUESTS ({{ store.results.requests.length }} FOUND)</p>
                <div class="result-list">
                  <button
                    v-for="item in store.results.requests"
                    :key="item.id"
                    class="result-row"
                    @click="navigateTo(item)"
                  >
                    <div class="result-row__text">
                      <span class="result-row__label">{{ item.label }}</span>
                      <span v-if="item.sublabel" class="result-row__sub">{{ item.sublabel }}</span>
                    </div>
                    <span class="result-row__arrow">›</span>
                  </button>
                </div>
              </div>

              <!-- FE Units -->
              <div v-if="store.results.feUnits.length" class="result-group">
                <p class="block-label">FIRE EXTINGUISHER UNITS ({{ store.results.feUnits.length }} FOUND)</p>
                <div class="result-list">
                  <button
                    v-for="item in store.results.feUnits"
                    :key="item.id"
                    class="result-row"
                    @click="navigateTo(item)"
                  >
                    <div class="result-row__text">
                      <span class="result-row__label">{{ item.label }}</span>
                      <span v-if="item.sublabel" class="result-row__sub">{{ item.sublabel }}</span>
                    </div>
                    <span class="result-row__arrow">›</span>
                  </button>
                </div>
              </div>

            </template>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/search'

const store  = useSearchStore()
const router = useRouter()

const localQuery = ref('')
const inputRef   = ref(null)

watch(() => store.isOpen, async (val) => {
  if (val) {
    localQuery.value = store.query
    await nextTick()
    inputRef.value?.focus()
  }
})

function selectRecent(term) {
  localQuery.value = term
  store.selectRecent(term)
}

function navigateTo(item) {
  store.closeSearch()
  router.push(item.route)
}
</script>

<style scoped>
/* Full-screen overlay */
.search-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 8000;
  display: flex;
  flex-direction: column;
}

/* Panel fills the screen */
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Input row */
.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 12px;
  background: var(--surface);
  border-bottom: 1.5px solid var(--border);
  flex-shrink: 0;
}

.search-input-row__icon { font-size: 18px; flex-shrink: 0; opacity: 0.5; }

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 17px;
  font-weight: 500;
  color: var(--text-primary);
  background: transparent;
  min-height: 44px;
  -webkit-appearance: none;
appearance: none;
}
.search-input::placeholder { color: var(--text-disabled); }

.cancel-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 700;
  color: var(--blue);
  cursor: pointer;
  padding: 8px 4px;
  min-height: 44px;
}

/* Body */
.search-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Searching */
.searching-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 0;
  font-size: 15px;
  color: var(--text-secondary);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid var(--border);
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Hints */
.hints-block { display: flex; flex-direction: column; gap: 10px; }
.hints-block__title { font-size: 15px; color: var(--text-secondary); margin: 0; }
.hints-list {
  list-style: disc;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hints-list li { font-size: 15px; color: var(--text-primary); line-height: 1.5; }

/* Recent searches */
.recent-block { display: flex; flex-direction: column; gap: 12px; }
.recent-block__header { display: flex; justify-content: space-between; align-items: center; }

.block-label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin: 0;
}

.recent-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recent-pill {
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
}

.recent-pill__term {
  padding: 8px 4px 8px 14px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  min-height: 40px;
}
.recent-pill__term:hover { color: var(--blue); }

.recent-pill__remove {
  padding: 8px 12px 8px 6px;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 40px;
  line-height: 1;
}
.recent-pill__remove:hover { color: var(--red); }

/* No results */
.no-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 32px 0;
}
.no-results__title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; }
.no-results__sub   { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0; max-width: 300px; }

/* Results */
.result-group { display: flex; flex-direction: column; gap: 8px; }

.result-list {
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  min-height: 56px;
  border-bottom: 1px solid var(--divider);
  transition: background 0.1s;
}
.result-row:last-child { border-bottom: none; }
.result-row:hover      { background: var(--bg); }
.result-row:active     { background: var(--blue-light); }

.result-row__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.result-row__label {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.result-row__sub {
  font-size: 13px;
  color: var(--text-secondary);
}
.result-row__arrow { font-size: 20px; color: var(--text-secondary); flex-shrink: 0; }

/* Transitions */
.search-modal-enter-active,
.search-modal-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.search-modal-enter-from,
.search-modal-leave-to     { opacity: 0; transform: translateY(-12px); }
</style>
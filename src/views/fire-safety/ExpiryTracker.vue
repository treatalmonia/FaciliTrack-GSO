<template>
  <div class="expiry-page">

    <header class="expiry-header">
      <h1 class="expiry-header__title">Expiry Tracker</h1>
      <p class="expiry-header__subtitle">All fire extinguisher units sorted by expiry date</p>
    </header>

    <!-- Tabs -->
    <div class="tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="[`tab--${tab.color}`, { 'tab--active': activeTab === tab.key }]"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count > 0" class="tab__count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading.units" class="skeleton-list">
      <div v-for="n in 4" :key="n" class="skeleton" style="height: 120px" />
    </div>

    <!-- Error -->
    <div v-else-if="store.error.units" class="error-banner">
      Could not load units. Please check your connection and try again.
    </div>

    <template v-else>

      <!-- Empty state per tab -->
      <div v-if="!visibleUnits.length" class="empty-state">
        <span class="empty-state__icon">{{ emptyIcon }}</span>
        <p class="empty-state__title">{{ emptyTitle }}</p>
        <p class="empty-state__subtitle">{{ emptySubtitle }}</p>
      </div>

      <!-- Unit list -->
      <div v-else class="units-list">
        <div
          v-for="unit in visibleUnits"
          :key="unit.unit_id"
          class="unit-card"
          :class="unitCardClass(unit)"
        >
          <!-- Top row: building + expiry status -->
          <div class="unit-card__top">
            <div class="unit-card__location">
              <span class="unit-card__building">{{ unit.building?.building_name ?? '—' }}</span>
              <span class="unit-card__room">
                {{ unit.floor_level }} — {{ unit.room_location }}
              </span>
            </div>
            <span class="expiry-label" :class="store.getExpiryClass(unit.date_expires)">
              {{ store.getDaysLabel(unit.date_expires) }}
            </span>
          </div>

          <!-- Details row -->
          <div class="unit-card__details">
            <span class="detail-pill">{{ feLabel(unit.fe_size) }}</span>
            <span class="detail-pill">{{ unit.current_condition }}</span>
            <span v-if="unit.supplier" class="detail-pill detail-pill--gray">
              {{ unit.supplier }}
            </span>
          </div>

          <!-- Dates row -->
          <div class="unit-card__dates">
            <span>
              Purchased / Refilled:
              <strong>{{ formatDate(unit.date_purchased_or_refilled) }}</strong>
            </span>
            <span>
              Expires:
              <strong :class="store.getExpiryClass(unit.date_expires)">
                {{ formatDate(unit.date_expires) }}
              </strong>
            </span>
          </div>

          <!-- Action -->
          <button
            class="refill-btn"
            @click="openRefillForm(unit)"
          >
            🔄 Log Refill
          </button>
        </div>
      </div>
    </template>

    <!-- ── Refill / Condition Dialog ── -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="showRefillDialog" class="dialog-overlay" @click.self="showRefillDialog = false">
          <div class="dialog">
            <h2 class="dialog__title">Log Refill</h2>
            <p class="dialog__body">
              <strong>{{ refillUnit?.building?.building_name }}</strong> —
              {{ refillUnit?.floor_level }} · {{ refillUnit?.room_location }}
              <br />
              {{ feLabel(refillUnit?.fe_size) }}
            </p>

            <div class="field">
              <label class="field__label">Date refilled</label>
              <input
                v-model="refillForm.date_refilled"
                type="date"
                class="field__input"
                :max="todayStr"
              />
            </div>

            <!-- Auto-calculated new expiry -->
            <div class="refill-preview">
              <span class="refill-preview__label">New expiry date (auto-calculated)</span>
              <span class="refill-preview__date">
                {{ formatDate(store.computeNewExpiry(refillForm.date_refilled)) }}
              </span>
              <span class="refill-preview__note">Exactly 2 years from refill date</span>
            </div>

            <div class="field">
              <label class="field__label">Supplier</label>
              <input v-model="refillForm.supplier" class="field__input" />
            </div>

            <div class="field">
              <label class="field__label">Warranty</label>
              <div class="warranty-btns">
                <button
                  class="choice-btn"
                  :class="{ 'choice-btn--active': refillForm.warranty_years === 1 }"
                  @click="refillForm.warranty_years = 1"
                >1 Year</button>
                <button
                  class="choice-btn"
                  :class="{ 'choice-btn--active': refillForm.warranty_years === 2 }"
                  @click="refillForm.warranty_years = 2"
                >2 Years</button>
              </div>
            </div>

            <p v-if="refillError" class="field__error">{{ refillError }}</p>

            <div class="dialog__actions">
              <button class="dialog__btn dialog__btn--cancel" @click="showRefillDialog = false">
                Cancel
              </button>
              <button
                class="dialog__btn dialog__btn--confirm"
                :disabled="store.loading.logCondition"
                @click="handleRefillSave"
              >
                {{ store.loading.logCondition ? 'Saving…' : 'Save Refill' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
import { useRoute } from 'vue-router'
import { useFireSafetyStore } from '@/stores/firesafety'
import ToastNotification from '@/components/common/ToastNotification.vue'

const route  = useRoute()
const store  = useFireSafetyStore()

const todayStr = new Date().toISOString().split('T')[0]

// ── Tabs ──────────────────────────────────────────────────────────────────
const activeTab = ref(route.query.tab === 'expired' ? 'expired' : route.query.tab === 'soon' ? 'soon' : 'all')

const tabs = computed(() => [
  {
    key:   'expired',
    label: 'Expired',
    color: 'red',
    count: store.expiredUnits.length,
  },
  {
    key:   'soon',
    label: 'Expiring Within 60 Days',
    color: 'amber',
    count: store.expiringSoonUnits.length,
  },
  {
    key:   'all',
    label: 'All Units',
    color: 'gray',
    count: store.units.length,
  },
])

const visibleUnits = computed(() => {
  if (activeTab.value === 'expired') return store.expiredUnits
  if (activeTab.value === 'soon')    return store.expiringSoonUnits
  return store.units
})

// ── Empty state content per tab ───────────────────────────────────────────
const emptyIcon = computed(() => {
  if (activeTab.value === 'expired') return '✅'
  if (activeTab.value === 'soon')    return '✅'
  return '🧯'
})
const emptyTitle = computed(() => {
  if (activeTab.value === 'expired') return 'No expired extinguishers.'
  if (activeTab.value === 'soon')    return 'No extinguishers expiring within 60 days.'
  return 'No extinguisher units recorded yet.'
})
const emptySubtitle = computed(() => {
  if (activeTab.value === 'expired') return 'All units are within their valid dates.'
  if (activeTab.value === 'soon')    return 'All units have more than 60 days remaining.'
  return 'Units will appear here once added to the system.'
})

// ── Unit card styling ─────────────────────────────────────────────────────
function unitCardClass(unit) {
  const days = store.daysUntilExpiry(unit.date_expires)
  if (days < 0)  return 'unit-card--expired'
  if (days <= 60) return 'unit-card--soon'
  return ''
}

// ── Refill dialog ─────────────────────────────────────────────────────────
const showRefillDialog = ref(false)
const refillUnit       = ref(null)
const refillError      = ref('')
const refillForm = ref({
  date_refilled:  todayStr,
  supplier:       'TRI J&A',
  warranty_years: 2,
})
const toast = ref({ show: false, message: '', type: 'success' })

function openRefillForm(unit) {
  refillUnit.value  = unit
  refillError.value = ''
  refillForm.value  = { date_refilled: todayStr, supplier: 'TRI J&A', warranty_years: 2 }
  showRefillDialog.value = true
}

async function handleRefillSave() {
  refillError.value = ''
 
  const result = await store.logCondition(refillUnit.value.unit_id, {
  condition:      'FULL',
  isRefill:       true,
  date_refilled:  refillForm.value.date_refilled,
  supplier:       refillForm.value.supplier,
  warranty_years: refillForm.value.warranty_years,
})

  if (result) {
    showRefillDialog.value = false
    toast.value = {
      show: true,
      message: `Refill logged. New expiry: ${formatDate(store.computeNewExpiry(refillForm.value.date_refilled))}`,
      type: 'success',
    }
  } else {
    refillError.value = store.error.logCondition ?? 'Failed to save refill.'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function feLabel(size) {
  if (size === 'HCFC') return 'HCFC (server rooms)'
  return `${size} Fire Extinguisher`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

onMounted(async () => {
  await store.fetchAllUnits()
})
</script>

<style scoped>
.expiry-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 20px var(--page-pad) 96px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.expiry-header__title    { font-size: 24px; font-weight: 800; color: var(--text-primary); }
.expiry-header__subtitle { font-size: 14px; color: var(--text-secondary); margin-top: 2px; }

/* Tabs */
.tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.tabs::-webkit-scrollbar { display: none; }

.tab {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  white-space: nowrap;
  transition: all 0.15s;
}

.tab--red.tab--active    { border-color: var(--red);    background: var(--red-light);    color: var(--red); }
.tab--amber.tab--active  { border-color: var(--yellow); background: var(--yellow-light); color: var(--yellow); }
.tab--gray.tab--active   { border-color: var(--blue);   background: var(--blue-light);   color: var(--blue); }

.tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  background: rgba(0,0,0,0.12);
  font-size: 12px;
  font-weight: 800;
  padding: 0 5px;
}

/* Unit cards */
.units-list { display: flex; flex-direction: column; gap: 10px; }

.unit-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--border);
}
.unit-card--expired { border-left-color: var(--red); background: #fff8f8; }
.unit-card--soon    { border-left-color: var(--yellow); }

.unit-card__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.unit-card__location { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.unit-card__building { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.unit-card__room     { font-size: 13px; color: var(--text-secondary); }

.expiry-label {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 20px;
}
.expiry--expired { background: var(--red-light);    color: var(--red); }
.expiry--soon    { background: var(--yellow-light); color: var(--yellow); }
.expiry--ok      { background: var(--green-light);  color: var(--green); }

.unit-card__details {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-pill {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  background: var(--bg);
  color: var(--text-secondary);
  border: 1.5px solid var(--border);
}
.detail-pill--gray { opacity: 0.7; }

.unit-card__dates {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
  color: var(--text-secondary);
}

.refill-btn {
  align-self: flex-start;
  padding: 10px 18px;
  border: 2px solid var(--blue);
  border-radius: 8px;
  background: var(--blue-light);
  color: var(--blue);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  min-height: 44px;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
}
.empty-state__icon     { font-size: 48px; opacity: 0.5; }
.empty-state__title    { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; }
.empty-state__subtitle { font-size: 14px; color: var(--text-secondary); max-width: 280px; line-height: 1.6; }

/* Refill preview */
.refill-preview {
  background: var(--green-light);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.refill-preview__label { font-size: 12px; font-weight: 700; color: var(--green); text-transform: uppercase; letter-spacing: 0.05em; }
.refill-preview__date  { font-size: 20px; font-weight: 800; color: var(--green); }
.refill-preview__note  { font-size: 12px; color: var(--green); }

/* Warranty buttons */
.warranty-btns { display: flex; gap: 8px; }
.choice-btn {
  padding: 10px 20px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
}
.choice-btn--active { border-color: var(--blue); background: var(--blue-light); color: var(--blue); }

/* Skeleton */
.skeleton-list { display: flex; flex-direction: column; gap: 10px; }

/* Dialog */
.dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9000; padding: 24px; }
.dialog { background: var(--surface); border-radius: 18px; padding: 28px 24px; width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 16px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
.dialog__title { font-size: 18px; font-weight: 800; margin: 0; color: var(--text-primary); }
.dialog__body  { font-size: 15px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.dialog__actions { display: flex; gap: 10px; justify-content: flex-end; }
.dialog__btn { padding: 12px 20px; border-radius: 10px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; min-height: 48px; }
.dialog__btn--cancel  { background: var(--bg); color: var(--text-secondary); border: 2px solid var(--border); }
.dialog__btn--confirm { background: var(--blue); color: #fff; }
.dialog__btn:disabled { opacity: 0.45; cursor: not-allowed; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field__label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.field__input { padding: 12px 14px; border: 2px solid var(--border); border-radius: 8px; font-size: 15px; min-height: 48px; width: 100%; box-sizing: border-box; }
.field__error { font-size: 13px; color: var(--red); font-weight: 600; }

.dialog-enter-active, .dialog-leave-active { transition: all 0.2s ease; }
.dialog-enter-from, .dialog-leave-to { opacity: 0; transform: scale(0.96); }
</style>
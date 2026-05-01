import { createRouter, createWebHistory } from 'vue-router'

// ── Electrical views ────────────────────────────────────────────────────────
import ElectricalDashboard from '@/views/electrical/ElectricalDashboard.vue'
import BuildingView        from '@/views/electrical/BuildingView.vue'
import RoomDetail          from '@/views/electrical/RoomDetail.vue'
import NewRequest          from '@/views/electrical/NewRequest.vue'
import ElectricalReports   from '@/views/electrical/ElectricalReports.vue'

// ── Fire Safety views ───────────────────────────────────────────────────────
import FireSafetyDashboard from '@/views/fire-safety/FireSafetyDashboard.vue'
import BFPReport           from '@/views/fire-safety/BFPReport.vue'
import ExpiryTracker       from '@/views/fire-safety/ExpiryTracker.vue'
import MovementLog         from '@/views/fire-safety/MovementLog.vue'

// ── Energy views ─────────────────────────────────────────────────────────────
import EnergyHome     from '@/views/energy/EnergyHome.vue'
import EnterReadings  from '@/views/energy/EnterReadings.vue'
import ReadingHistory from '@/views/energy/ReadingHistory.vue'

const routes = [
  // ── Root redirect ──────────────────────────────────────────────────────────
  {
    path: '/',
    redirect: '/electrical',
  },

  // ── Electrical ─────────────────────────────────────────────────────────────
  {
    path: '/electrical',
    name: 'ElectricalDashboard',
    component: ElectricalDashboard,
    meta: { module: 'electrical', title: 'Electrical Repairs' },
  },
  {
    path: '/electrical/building/:id',
    name: 'BuildingView',
    component: BuildingView,
    props: true,
    meta: { module: 'electrical', title: 'Building' },
  },
  {
    path: '/electrical/building/:id/room/:roomId',
    name: 'RoomDetail',
    component: RoomDetail,
    props: true,
    meta: { module: 'electrical', title: 'Room Detail' },
  },
  {
    path: '/electrical/new-request',
    name: 'NewRequest',
    component: NewRequest,
    meta: { module: 'electrical', title: 'New Request' },
  },
  {
    path: '/electrical/reports',
    name: 'ElectricalReports',
    component: ElectricalReports,
    meta: { module: 'electrical', title: 'Reports' },
  },

  // ── Fire Safety ────────────────────────────────────────────────────────────
  {
    path: '/fire-safety',
    name: 'FireSafetyDashboard',
    component: FireSafetyDashboard,
    meta: { module: 'fire-safety', title: 'Fire Safety' },
  },
  {
    path: '/fire-safety/bfp-report',
    name: 'BFPReport',
    component: BFPReport,
    meta: { module: 'fire-safety', title: 'BFP Report' },
  },
  {
    path: '/fire-safety/expiry-tracker',
    name: 'ExpiryTracker',
    component: ExpiryTracker,
    meta: { module: 'fire-safety', title: 'Expiry Tracker' },
  },
  {
    path: '/fire-safety/movement-log',
    name: 'MovementLog',
    component: MovementLog,
    meta: { module: 'fire-safety', title: 'Movement Log' },
  },

  // ── Energy ─────────────────────────────────────────────────────────────────
  {
    path: '/energy',
    name: 'EnergyHome',
    component: EnergyHome,
    meta: { module: 'energy', title: 'Energy Monitoring' },
  },
  {
    path: '/energy/enter-readings',
    name: 'EnterReadings',
    component: EnterReadings,
    meta: { module: 'energy', title: 'Enter Readings' },
  },
  {
    path: '/energy/history',
    name: 'ReadingHistory',
    component: ReadingHistory,
    meta: { module: 'energy', title: 'Reading History' },
  },

  // ── 404 catch-all ──────────────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    redirect: '/electrical',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router

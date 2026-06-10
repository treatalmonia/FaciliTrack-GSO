import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useConnectionStore = defineStore('connection', () => {
  const isOnline = ref(navigator.onLine)

  const statusLabel = computed(() =>
    isOnline.value ? 'Online' : 'Offline'
  )

  function handleOnline()  { isOnline.value = true  }
  function handleOffline() { isOnline.value = false }

  function startWatching() {
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  function stopWatching() {
    window.removeEventListener('online',  handleOnline)
    window.removeEventListener('offline', handleOffline)
  }

  return { isOnline, statusLabel, startWatching, stopWatching }
})
<template>
  <div class="combobox" ref="containerRef">
    <div class="combobox__input-wrap">
      <input
        ref="inputRef"
        v-model="inputVal"
        class="combobox__input"
        :placeholder="placeholder"
        autocomplete="off"
        @focus="open"
        @input="open"
        @keydown.enter.prevent="selectOrAdd"
        @keydown.escape="close"
        @keydown.arrow-down.prevent="moveDown"
        @keydown.arrow-up.prevent="moveUp"
      />
      <button type="button" class="combobox__arrow" @click="toggleOpen">▾</button>
    </div>

    <ul v-if="isOpen && filtered.length" class="combobox__dropdown">
      <li
        v-for="(opt, i) in filtered"
        :key="opt"
        class="combobox__option"
        :class="{ 'combobox__option--active': i === activeIndex }"
        @mousedown.prevent="select(opt)"
      >
        {{ opt }}
      </li>
      <li
        v-if="inputVal.trim() && !exactMatch"
        class="combobox__option combobox__option--add"
        @mousedown.prevent="selectOrAdd"
      >
        ＋ Add "{{ inputVal.trim() }}"
      </li>
    </ul>

    <ul v-else-if="isOpen && inputVal.trim() && !exactMatch" class="combobox__dropdown">
      <li
        class="combobox__option combobox__option--add"
        @mousedown.prevent="selectOrAdd"
      >
        ＋ Add "{{ inputVal.trim() }}"
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue:  { type: String, default: '' },
  options:     { type: Array,  default: () => [] },
  placeholder: { type: String, default: 'Type or select…' },
})

const emit = defineEmits(['update:modelValue', 'add'])

const inputVal   = ref(props.modelValue)
const isOpen     = ref(false)
const activeIndex = ref(-1)
const containerRef = ref(null)
const inputRef     = ref(null)

watch(() => props.modelValue, (val) => { inputVal.value = val })
watch(inputVal, (val) => emit('update:modelValue', val))

const filtered = computed(() => {
  const q = inputVal.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => o.toLowerCase().includes(q))
})

const exactMatch = computed(() =>
  props.options.some((o) => o.toLowerCase() === inputVal.value.trim().toLowerCase())
)

function open()       { isOpen.value = true; activeIndex.value = -1 }
function close()      { isOpen.value = false }
function toggleOpen() { isOpen.value ? close() : open() }

function select(opt) {
  inputVal.value = opt
  emit('update:modelValue', opt)
  close()
}

function selectOrAdd() {
  const val = inputVal.value.trim()
  if (!val) return
  emit('add', val)
  select(val)
}

function moveDown() {
  if (activeIndex.value < filtered.value.length - 1) activeIndex.value++
}
function moveUp() {
  if (activeIndex.value > 0) activeIndex.value--
}

function onClickOutside(e) {
  if (containerRef.value && !containerRef.value.contains(e.target)) close()
}

onMounted(()   => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<style scoped>
.combobox { position: relative; width: 100%; }

.combobox__input-wrap {
  display: flex;
  align-items: center;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  min-height: 48px;
  transition: border-color 0.15s;
}
.combobox__input-wrap:focus-within { border-color: var(--blue); background: #fff; }

.combobox__input {
  flex: 1;
  border: none;
  outline: none;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text-primary);
  background: transparent;
  min-height: 44px;
}

.combobox__arrow {
  padding: 0 12px;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
}

.combobox__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  list-style: none;
  padding: 4px 0;
  z-index: 999;
  max-height: 220px;
  overflow-y: auto;
}

.combobox__option {
  padding: 12px 16px;
  font-size: 15px;
  color: var(--text-primary);
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.combobox__option:hover,
.combobox__option--active { background: var(--blue-light); color: var(--blue); }

.combobox__option--add {
  color: var(--blue);
  font-weight: 600;
  border-top: 1px solid var(--divider);
}
</style>
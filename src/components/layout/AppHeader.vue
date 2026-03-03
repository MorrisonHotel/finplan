<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app.store'
import { currentMonthName } from '@/utils/date-helpers'

const store = useAppStore()
const isSimulation = computed(() => store.simulation.isActive)
const monthName = currentMonthName()

function toggleSimulation() {
  if (isSimulation.value) {
    store.stopSimulation()
  } else {
    // Открываем панель симуляции — emit наверх
    emit('open-simulation')
  }
}

const emit = defineEmits<{ 'open-simulation': [] }>()
</script>

<template>
  <nav class="navbar navbar-expand-lg px-3 py-2">
    <div class="container-fluid">
      <span class="navbar-brand fw-bold fs-5 d-flex align-items-center gap-2">
        <i class="bi bi-bar-chart-fill text-success"></i>
        FinPlan
      </span>

      <span class="text-gh-muted d-none d-md-block" style="color: #8b949e !important; font-size: 13px;">
        {{ monthName }}
      </span>

      <div class="d-flex align-items-center gap-2">
        <button
          class="btn btn-sm"
          :class="isSimulation ? 'btn-warning' : 'btn-outline-light'"
          @click="toggleSimulation"
        >
          <i class="bi bi-magic me-1"></i>
          {{ isSimulation ? 'Симуляция активна' : 'А что если?' }}
        </button>

        <button
          class="btn btn-sm btn-outline-light"
          data-bs-toggle="modal"
          data-bs-target="#settingsModal"
        >
          <i class="bi bi-gear"></i>
        </button>
      </div>
    </div>
  </nav>
</template>

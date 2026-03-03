<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app.store'

const store = useAppStore()

const mortgageName = computed(() => {
  const m = store.mortgages.find((m) => m.id === store.simulation.mortgageId)
  return m?.name ?? '—'
})

const ep = computed(() => store.simulation.earlyPayment)

const frequencyLabel: Record<string, string> = {
  once: 'разово',
  monthly: 'ежемесячно',
  quarterly: 'ежеквартально',
  yearly: 'ежегодно',
}

const typeLabel: Record<string, string> = {
  'reduce-term': 'уменьшение срока',
  'reduce-payment': 'уменьшение платежа',
}
</script>

<template>
  <div class="simulation-banner px-3 py-2 d-flex align-items-center justify-content-between">
    <div class="d-flex align-items-center gap-2">
      <i class="bi bi-magic"></i>
      <strong>Режим симуляции:</strong>
      <span>{{ mortgageName }}</span>
      <span class="mx-1">·</span>
      <span>{{ ep.amount.toLocaleString('ru-RU') }} ₽</span>
      <span class="mx-1">·</span>
      <span>{{ frequencyLabel[ep.frequency] }}</span>
      <span class="mx-1">·</span>
      <span>{{ typeLabel[ep.type] }}</span>
    </div>
    <button class="btn btn-sm btn-outline-warning" @click="store.stopSimulation()">
      <i class="bi bi-x-lg me-1"></i>Выйти из симуляции
    </button>
  </div>
</template>

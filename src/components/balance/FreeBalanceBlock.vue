<script setup lang="ts">
import { computed } from 'vue'
import { useDashboard } from '@/composables/useDashboard'
import { useAppStore } from '@/stores/app.store'
import { formatMoney } from '@/utils/formatters'

const store = useAppStore()
const {
  totalIncome,
  totalMortgagePayments,
  totalFixedExpenses,
  totalExpenses,
  freeBalance,
  totalGoalContributions,
  effectiveFreeBalance,
  freelanceEarned,
} = useDashboard()

// Алерт про подработку показываем только если НЕ привязана к потоку доходов
const showFreelanceAlert = computed(
  () => !store.freelanceConfig.linkedIncomeItemId && freelanceEarned.value > 0,
)

const isPositive = computed(() => effectiveFreeBalance.value >= 0)

const expenseRatio = computed(() => {
  if (totalIncome.value <= 0) return 0
  const total = totalExpenses.value + totalGoalContributions.value
  return Math.min(100, (total / totalIncome.value) * 100)
})
</script>

<template>
  <div class="card h-100 w-100 d-flex flex-column">
    <div class="card-header d-flex align-items-center gap-2">
      <i class="bi bi-wallet2 text-warning"></i>
      <span class="block-title">Свободный остаток</span>
    </div>

    <div class="card-body d-flex flex-column gap-3">
      <!-- Главная цифра -->
      <div class="text-center py-2">
        <div class="text-gh-muted mb-1" style="font-size: 11px; text-transform: uppercase; letter-spacing: .04em;">
          После всех обязательств и взносов по целям
        </div>
        <div
          class="money-large"
          :class="isPositive ? 'money-positive' : 'money-negative'"
          style="font-size: 36px;"
        >
          {{ formatMoney(effectiveFreeBalance) }}
        </div>
        <div v-if="!isPositive" class="text-danger mt-1" style="font-size: 12px;">
          <i class="bi bi-exclamation-triangle me-1"></i>Расходы и цели превышают доходы
        </div>
      </div>

      <!-- Расходы / доходы прогресс-бар -->
      <div>
        <div class="progress mb-1" style="height: 8px;">
          <div
            class="progress-bar"
            :class="expenseRatio >= 100 ? 'bg-danger' : expenseRatio >= 80 ? 'bg-warning' : 'bg-success'"
            :style="{ width: Math.min(100, expenseRatio) + '%' }"
          ></div>
        </div>
        <div class="d-flex justify-content-between text-gh-muted" style="font-size: 11px;">
          <span>Расходы + цели {{ expenseRatio.toFixed(0) }}% от доходов</span>
          <span>{{ formatMoney(totalExpenses + totalGoalContributions) }} / {{ formatMoney(totalIncome) }}</span>
        </div>
      </div>

      <!-- Разбивка -->
      <div class="d-flex flex-column gap-1" style="font-size: 13px;">
        <div class="d-flex justify-content-between">
          <span class="text-gh-muted">
            <i class="bi bi-arrow-down-circle text-success me-1"></i>Доходы этого месяца
          </span>
          <span class="money-positive fw-semibold">{{ formatMoney(totalIncome) }}</span>
        </div>
        <div class="d-flex justify-content-between">
          <span class="text-gh-muted">
            <i class="bi bi-bank text-danger me-1"></i>Ипотеки
          </span>
          <span class="text-danger">−{{ formatMoney(totalMortgagePayments) }}</span>
        </div>
        <div class="d-flex justify-content-between">
          <span class="text-gh-muted">
            <i class="bi bi-receipt text-danger me-1"></i>Прочие расходы
          </span>
          <span class="text-danger">−{{ formatMoney(totalFixedExpenses) }}</span>
        </div>

        <!-- Взносы по целям -->
        <div v-if="totalGoalContributions > 0" class="d-flex justify-content-between">
          <span class="text-gh-muted">
            <i class="bi bi-trophy text-warning me-1"></i>Взносы по целям
          </span>
          <span class="text-warning fw-semibold">−{{ formatMoney(totalGoalContributions) }}</span>
        </div>

        <div class="border-top pt-1 mt-1 d-flex justify-content-between fw-bold">
          <span>Итого свободно</span>
          <span :class="isPositive ? 'money-positive' : 'money-negative'">
            {{ formatMoney(effectiveFreeBalance) }}
          </span>
        </div>
      </div>

      <!-- Подработка не привязана к потоку — предупреждаем, что не учтена -->
      <div
        v-if="showFreelanceAlert"
        class="alert alert-light py-2 px-3 mb-0"
        style="font-size: 12px; border: 1px solid var(--gh-border);"
      >
        <i class="bi bi-code-slash me-1 text-primary"></i>
        Подработка <strong>{{ formatMoney(freelanceEarned) }}</strong> не привязана к потоку доходов
        — не включена в остаток
      </div>
    </div>
  </div>
</template>

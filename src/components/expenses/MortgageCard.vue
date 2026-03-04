<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import type { Mortgage, RatePeriod } from '@/types/mortgage'
import { MortgageCalculatorService } from '@/services/mortgage-calculator.service'
import { SimulationService } from '@/services/simulation.service'
import { useAppStore } from '@/stores/app.store'
import { formatMoney, formatPercent, formatMonths } from '@/utils/formatters'
import { formatDate, formatDayMonth, today, toISODate, parseDate, monthsBetween } from '@/utils/date-helpers'

const props = defineProps<{ mortgage: Mortgage }>()
const store = useAppStore()

const summary = computed(() => MortgageCalculatorService.getSummary(props.mortgage))

// ─── Симуляция ───────────────────────────────────────────────────────────────

const isSimulated = computed(
  () => store.simulation.isActive && store.simulation.mortgageId === props.mortgage.id,
)

const simComparison = computed(() => {
  if (!isSimulated.value) return null
  try {
    return SimulationService.compare(props.mortgage, store.simulation.earlyPayment)
  } catch {
    return null
  }
})

// Показывать плашку смены ставки только если:
// 1. Есть активный период (мы не в "до первого периода")
// 2. До смены <= 6 месяцев
const showRateChangeAlert = computed(() => {
  const nr = summary.value.nextRateChange
  if (!nr) return false
  const todayStr = toISODate(today())
  const hasActivePeriod = props.mortgage.ratePeriods.some((p: RatePeriod) => p.startDate <= todayStr)
  if (!hasActivePeriod) return false
  const months = monthsBetween(today(), parseDate(nr.startDate))
  return months <= 6
})

const interestPercent = computed(() => {
  if (summary.value.monthlyPayment === 0) return 0
  return (summary.value.monthlyInterest / summary.value.monthlyPayment) * 100
})

// ─── Modal ────────────────────────────────────────────────────────────────────

const modalEl = ref<HTMLElement | null>(null)
let modalInstance: Modal | null = null

onMounted(() => {
  if (modalEl.value) modalInstance = new Modal(modalEl.value)
})

// Форма редактирования
const form = ref({ ...props.mortgage })
const ratePeriods = ref<RatePeriod[]>(props.mortgage.ratePeriods.map((r) => ({ ...r })))

function openEdit() {
  form.value = { ...props.mortgage }
  ratePeriods.value = props.mortgage.ratePeriods.map((r) => ({ ...r }))
  modalInstance?.show()
}

function addRatePeriod() {
  ratePeriods.value.push({ id: crypto.randomUUID(), startDate: '', rate: 0 })
}

function removeRatePeriod(idx: number) {
  if (ratePeriods.value.length > 1) ratePeriods.value.splice(idx, 1)
}

function saveEdit() {
  store.updateMortgage(props.mortgage.id, {
    ...form.value,
    ratePeriods: ratePeriods.value.filter((r) => r.startDate && r.rate > 0),
  })
  modalInstance?.hide()
}

function deleteMortgage() {
  if (confirm(`Удалить ипотеку "${props.mortgage.name}"?`)) {
    store.removeMortgage(props.mortgage.id)
    modalInstance?.hide()
  }
}
</script>

<template>
  <div class="card h-100">
    <!-- Header -->
    <div class="card-header d-flex align-items-center justify-content-between py-2">
      <span class="block-title text-truncate" style="max-width: 200px;" :title="mortgage.name">
        {{ mortgage.name }}
      </span>
      <div class="d-flex align-items-center gap-1">
        <span class="badge rounded-pill"
          :class="mortgage.paymentType === 'annuity' ? 'bg-secondary' : 'bg-info text-dark'">
          {{ mortgage.paymentType === 'annuity' ? 'Аннуитет' : 'Дифф.' }}
        </span>
        <button class="btn btn-sm btn-link text-gh-muted p-0 ms-1" @click="openEdit">
          <i class="bi bi-pencil"></i>
        </button>
      </div>
    </div>

    <div class="card-body p-3">
      <!-- Остаток долга -->
      <div class="mb-3">
        <div class="text-gh-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: .04em;">
          Остаток долга
        </div>
        <div class="money-large money-neutral">
          {{ formatMoney(mortgage.currentBalance) }}
        </div>
        <div class="text-gh-muted" style="font-size: 12px;">
          до {{ formatDate(summary.endDate) }} · {{ formatMonths(summary.remainingMonths) }}
        </div>
      </div>

      <!-- Ставка -->
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="text-gh-muted">Ставка</span>
        <span class="fw-semibold">{{ formatPercent(summary.currentRate) }}</span>
      </div>

      <!-- Платёж -->
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="text-gh-muted">Платёж {{ mortgage.paymentDayOfMonth }}-го</span>
        <span class="fw-semibold">{{ formatMoney(summary.monthlyPayment) }}</span>
      </div>

      <!-- Разбивка: тело / проценты -->
      <div class="mb-2">
        <div class="progress mb-1" style="height: 6px;">
          <div
            class="progress-bar"
            :style="{ width: interestPercent + '%', backgroundColor: '#c97878' }"
            :title="`Проценты: ${formatMoney(summary.monthlyInterest)}`"
          ></div>
          <div
            class="progress-bar"
            :style="{ width: (100 - interestPercent) + '%', backgroundColor: '#6aaa82' }"
            :title="`Тело: ${formatMoney(summary.monthlyPrincipal)}`"
          ></div>
        </div>
        <div class="d-flex justify-content-between text-gh-muted" style="font-size: 11px;">
          <span><span style="color: #c97878">■</span> Проценты {{ formatMoney(summary.monthlyInterest) }}</span>
          <span><span style="color: #6aaa82">■</span> Тело {{ formatMoney(summary.monthlyPrincipal) }}</span>
        </div>
      </div>

      <!-- Предупреждение о смене ставки -->
      <div v-if="showRateChangeAlert" class="alert alert-warning py-1 px-2 mb-0" style="font-size: 12px;">
        <i class="bi bi-exclamation-triangle me-1"></i>
        С {{ formatDayMonth(summary.nextRateChange!.startDate) }}
        ставка → <strong>{{ formatPercent(summary.nextRateChange!.rate) }}</strong>,
        платёж ~{{ formatMoney(summary.estimatedPaymentAfterRateChange ?? 0) }}
      </div>

      <!-- Симуляция: Было / Стало -->
      <div v-if="isSimulated && simComparison" class="mt-2 p-2 rounded" style="background: #fff8c5; border: 1px solid #d4a017;">
        <div class="d-flex align-items-center gap-1 mb-2" style="font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #7d4e00;">
          <i class="bi bi-magic"></i>
          <span class="fw-semibold">Симуляция: досрочное погашение</span>
        </div>
        <div class="d-flex justify-content-between mb-1" style="font-size: 12px;">
          <span class="text-gh-muted">Срок</span>
          <span>
            <span class="text-gh-muted text-decoration-line-through me-1">{{ formatDate(simComparison.originalEndDate) }}</span>
            <span class="text-success fw-semibold">{{ formatDate(simComparison.newEndDate) }}</span>
          </span>
        </div>
        <div class="d-flex justify-content-between mb-1" style="font-size: 12px;">
          <span class="text-gh-muted">Переплата</span>
          <span>
            <span class="text-gh-muted text-decoration-line-through me-1">{{ formatMoney(simComparison.originalTotalInterest) }}</span>
            <span class="text-success fw-semibold">{{ formatMoney(simComparison.newTotalInterest) }}</span>
          </span>
        </div>
        <div class="border-top pt-1 mt-1 d-flex justify-content-between" style="font-size: 12px;">
          <span class="text-gh-muted">Экономия</span>
          <span class="fw-bold text-success">
            {{ formatMoney(simComparison.savedInterest) }}
            <span v-if="simComparison.savedMonths > 0" class="text-primary ms-1">
              / −{{ formatMonths(simComparison.savedMonths) }}
            </span>
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Редактирование ипотеки -->
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Редактировать ипотеку</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Название</label>
              <input v-model="form.name" class="form-control" placeholder="Ипотека Сбербанк" />
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Дата выдачи</label>
              <input v-model="form.startDate" type="date" class="form-control" />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Срок (месяцев)</label>
              <input v-model.number="form.termMonths" type="number" min="1" class="form-control" />
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Первоначальная сумма</label>
              <div class="input-group">
                <input v-model.number="form.initialAmount" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Текущий остаток долга</label>
              <div class="input-group">
                <input v-model.number="form.currentBalance" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Тип платежа</label>
              <select v-model="form.paymentType" class="form-select">
                <option value="annuity">Аннуитетный</option>
                <option value="differentiated">Дифференцированный</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">День платежа</label>
              <input v-model.number="form.paymentDayOfMonth" type="number" min="1" max="28" class="form-control" />
            </div>

            <!-- Периоды ставок -->
            <div class="col-12">
              <label class="form-label fw-semibold">Периоды ставок</label>
              <div v-for="(period, idx) in ratePeriods" :key="period.id" class="d-flex gap-2 mb-2 align-items-center">
                <input v-model="period.startDate" type="date" class="form-control" style="max-width: 160px;" />
                <div class="input-group" style="max-width: 130px;">
                  <input v-model.number="period.rate" type="number" step="0.01" min="0" class="form-control" placeholder="Ставка" />
                  <span class="input-group-text">%</span>
                </div>
                <button
                  class="btn btn-sm btn-outline-danger"
                  :disabled="ratePeriods.length === 1"
                  @click="removeRatePeriod(idx)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
              <button class="btn btn-sm btn-outline-secondary" @click="addRatePeriod">
                <i class="bi bi-plus me-1"></i>Добавить период
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer justify-content-between">
          <button class="btn btn-sm btn-outline-danger" @click="deleteMortgage">
            <i class="bi bi-trash me-1"></i>Удалить
          </button>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Отмена</button>
            <button class="btn btn-sm btn-primary" @click="saveEdit">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

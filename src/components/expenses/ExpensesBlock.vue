<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { useAppStore } from '@/stores/app.store'
import { MortgageCalculatorService } from '@/services/mortgage-calculator.service'
import { formatMoney } from '@/utils/formatters'
import type { Mortgage } from '@/types/mortgage'
import MortgageCard from './MortgageCard.vue'
import FixedExpenseList from './FixedExpenseList.vue'

const store = useAppStore()

const activeMortgages = computed(() => store.mortgages.filter((m) => m.isActive))
const activeExpenses = computed(() => store.fixedExpenses.filter((e) => e.isActive))

const totalMortgagePayments = computed(() =>
  activeMortgages.value.reduce(
    (sum, m) => sum + MortgageCalculatorService.getMonthlyPayment(m),
    0,
  ),
)

const totalFixedExpenses = computed(() =>
  activeExpenses.value.reduce((sum, e) => sum + e.amount, 0),
)

const totalExpenses = computed(() => totalMortgagePayments.value + totalFixedExpenses.value)

const totalMortgageDebt = computed(() =>
  activeMortgages.value.reduce((sum, m) => sum + m.currentBalance, 0),
)

const totalMonthlyInterest = computed(() =>
  activeMortgages.value.reduce(
    (sum, m) => sum + MortgageCalculatorService.getMonthlyInterest(m),
    0,
  ),
)

// ─── Добавление ипотеки ───────────────────────────────────────────────────────

const addModalEl = ref<HTMLElement | null>(null)
let addModal: Modal | null = null

onMounted(() => {
  if (addModalEl.value) addModal = new Modal(addModalEl.value)
})

const newMortgage = ref<Omit<Mortgage, 'id' | 'earlyPayments'>>({
  name: '',
  startDate: '',
  termMonths: 240,
  initialAmount: 0,
  currentBalance: 0,
  paymentType: 'annuity',
  paymentDayOfMonth: 10,
  ratePeriods: [{ id: crypto.randomUUID(), startDate: '', rate: 0 }],
  isActive: true,
})

function openAddMortgage() {
  newMortgage.value = {
    name: '',
    startDate: '',
    termMonths: 240,
    initialAmount: 0,
    currentBalance: 0,
    paymentType: 'annuity',
    paymentDayOfMonth: 10,
    ratePeriods: [{ id: crypto.randomUUID(), startDate: '', rate: 0 }],
    isActive: true,
  }
  addModal?.show()
}

function addRatePeriodNew() {
  newMortgage.value.ratePeriods.push({ id: crypto.randomUUID(), startDate: '', rate: 0 })
}

function removeRatePeriodNew(idx: number) {
  if (newMortgage.value.ratePeriods.length > 1) newMortgage.value.ratePeriods.splice(idx, 1)
}

function saveMortgage() {
  if (!newMortgage.value.name || newMortgage.value.currentBalance <= 0) return
  store.addMortgage({
    ...newMortgage.value,
    earlyPayments: [],
    ratePeriods: newMortgage.value.ratePeriods.filter((r) => r.startDate && r.rate > 0),
  })
  addModal?.hide()
}
</script>

<template>
  <div class="card">
    <!-- Header -->
    <div class="card-header d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-arrow-up-circle text-danger"></i>
        <span class="block-title">Расходы</span>
      </div>
      <div class="d-flex align-items-center gap-3">
        <span v-if="activeMortgages.length > 0" class="text-gh-muted pe-3" style="font-size: 11px; border-right: 1px solid var(--gh-border);">
          Долг: <span class="ms-1">{{ formatMoney(totalMortgageDebt) }}</span>
          <span class="mx-1">·</span>
          Проценты: <span class="ms-1">{{ formatMoney(totalMonthlyInterest) }} в мес.</span>
        </span>
        <span class="text-gh-muted" style="font-size: 13px;">
          Итого в месяц:
          <strong class="text-danger ms-1">{{ formatMoney(totalExpenses) }}</strong>
        </span>
        <button class="btn btn-sm btn-outline-secondary" @click="openAddMortgage">
          <i class="bi bi-plus me-1"></i>Ипотека
        </button>
      </div>
    </div>

    <div class="card-body p-3">
      <div class="row g-3">
        <!-- Карточки ипотек -->
        <div
          v-for="mortgage in activeMortgages"
          :key="mortgage.id"
          class="col-xl-3 col-lg-4 col-md-6"
        >
          <MortgageCard :mortgage="mortgage" />
        </div>

        <!-- Разделитель + фиксированные расходы -->
        <div class="col-xl col-lg-12" :class="activeMortgages.length > 0 ? 'border-start' : ''">
          <FixedExpenseList />

          <!-- Итог фиксированных расходов -->
          <div v-if="activeExpenses.length > 0" class="d-flex justify-content-between pt-2 mt-2 border-top">
            <span class="text-gh-muted fw-semibold" style="font-size: 13px;">Итого</span>
            <span class="fw-semibold text-danger">{{ formatMoney(totalFixedExpenses) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Добавить ипотеку -->
  <div class="modal fade" ref="addModalEl" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Добавить ипотеку</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Название</label>
              <input v-model="newMortgage.name" class="form-control" placeholder="Ипотека — Квартира на Садовой" />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Дата выдачи</label>
              <input v-model="newMortgage.startDate" type="date" class="form-control" />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Срок (месяцев)</label>
              <input v-model.number="newMortgage.termMonths" type="number" min="1" class="form-control" />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Первоначальная сумма</label>
              <div class="input-group">
                <input v-model.number="newMortgage.initialAmount" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Текущий остаток долга</label>
              <div class="input-group">
                <input v-model.number="newMortgage.currentBalance" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Тип платежа</label>
              <select v-model="newMortgage.paymentType" class="form-select">
                <option value="annuity">Аннуитетный</option>
                <option value="differentiated">Дифференцированный</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">День платежа</label>
              <input v-model.number="newMortgage.paymentDayOfMonth" type="number" min="1" max="28" class="form-control" />
            </div>

            <!-- Периоды ставок -->
            <div class="col-12">
              <label class="form-label fw-semibold">Периоды ставок</label>
              <div
                v-for="(period, idx) in newMortgage.ratePeriods"
                :key="period.id"
                class="d-flex gap-2 mb-2 align-items-center"
              >
                <input v-model="period.startDate" type="date" class="form-control" style="max-width: 160px;" />
                <div class="input-group" style="max-width: 130px;">
                  <input v-model.number="period.rate" type="number" step="0.01" min="0" class="form-control" placeholder="%" />
                  <span class="input-group-text">%</span>
                </div>
                <button
                  class="btn btn-sm btn-outline-danger"
                  :disabled="newMortgage.ratePeriods.length === 1"
                  @click="removeRatePeriodNew(idx)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
              <button class="btn btn-sm btn-outline-secondary" @click="addRatePeriodNew">
                <i class="bi bi-plus me-1"></i>Добавить период
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Отмена</button>
          <button class="btn btn-sm btn-primary" @click="saveMortgage">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>

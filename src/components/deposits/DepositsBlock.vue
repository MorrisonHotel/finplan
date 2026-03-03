<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { useAppStore } from '@/stores/app.store'
import { DepositCalculatorService } from '@/services/deposit-calculator.service'
import { formatMoney, formatPercent } from '@/utils/formatters'
import { formatDate } from '@/utils/date-helpers'
import type { Deposit } from '@/types/deposit'

const store = useAppStore()
const activeDeposits = computed(() => store.deposits.filter((d) => d.isActive))

function getResult(d: Deposit) {
  return DepositCalculatorService.getResult(d)
}

function progressPercent(d: Deposit): number {
  const start = new Date(d.startDate).getTime()
  const end = new Date(d.endDate).getTime()
  const now = Date.now()
  if (end <= start) return 100
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const modalEl = ref<HTMLElement | null>(null)
let modalInstance: Modal | null = null

onMounted(() => {
  if (modalEl.value) modalInstance = new Modal(modalEl.value)
})

const emptyForm = (): Omit<Deposit, 'id'> & { id?: string } => ({
  name: '',
  amount: 0,
  startDate: '',
  endDate: '',
  rate: 0,
  capitalization: true,
  autoRenewal: false,
  isActive: true,
})

const form = ref(emptyForm())

function openAdd() {
  form.value = emptyForm()
  modalInstance?.show()
}

function openEdit(d: Deposit) {
  form.value = { ...d }
  modalInstance?.show()
}

function save() {
  if (!form.value.name || form.value.amount <= 0 || !form.value.startDate || !form.value.endDate) return
  if (form.value.id) {
    store.updateDeposit(form.value.id, form.value as Deposit)
  } else {
    store.addDeposit(form.value as Omit<Deposit, 'id'>)
  }
  modalInstance?.hide()
}

function remove(id: string) {
  if (confirm('Удалить этот вклад?')) {
    store.removeDeposit(id)
    modalInstance?.hide()
  }
}

const totalDeposited = computed(() => activeDeposits.value.reduce((s, d) => s + d.amount, 0))
const totalAtEnd = computed(() =>
  activeDeposits.value.reduce((s, d) => s + DepositCalculatorService.getTotalAtEnd(d), 0),
)
</script>

<template>
  <div class="card h-100 w-100 d-flex flex-column">
    <!-- Header -->
    <div class="card-header d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-piggy-bank text-info"></i>
        <span class="block-title">Вклады</span>
      </div>
      <button class="btn btn-sm btn-outline-secondary" @click="openAdd">
        <i class="bi bi-plus"></i>
      </button>
    </div>

    <div class="card-body flex-grow-1 d-flex flex-column gap-3 p-3">
      <div v-if="activeDeposits.length === 0" class="text-gh-muted text-center py-3" style="font-size: 13px;">
        Нет вкладов. Нажмите «+» чтобы добавить.
      </div>

      <!-- Карточка вклада -->
      <div
        v-for="d in activeDeposits"
        :key="d.id"
        class="border rounded p-3"
        style="background: #f6f8fa;"
      >
        <div class="d-flex align-items-start justify-content-between mb-2">
          <div>
            <div class="fw-semibold" style="font-size: 13px;">{{ d.name }}</div>
            <div class="text-gh-muted" style="font-size: 11px;">
              {{ formatDate(d.startDate) }} — {{ formatDate(d.endDate) }}
              <span v-if="d.autoRenewal" class="badge bg-info text-dark ms-1" style="font-size: 10px;">Автопролонг.</span>
            </div>
          </div>
          <button class="btn btn-sm btn-link text-gh-muted p-0" @click="openEdit(d)">
            <i class="bi bi-pencil" style="font-size: 11px;"></i>
          </button>
        </div>

        <!-- Прогресс времени -->
        <div class="progress mb-2" style="height: 4px;">
          <div class="progress-bar bg-info" :style="{ width: progressPercent(d) + '%' }"></div>
        </div>

        <div class="row g-2" style="font-size: 12px;">
          <div class="col-6">
            <div class="text-gh-muted">Тело</div>
            <div class="fw-semibold">{{ formatMoney(d.amount) }}</div>
          </div>
          <div class="col-6">
            <div class="text-gh-muted">Ставка</div>
            <div class="fw-semibold">
              {{ formatPercent(d.rate) }}
              <span class="text-gh-muted">{{ d.capitalization ? '· кап.' : '· без кап.' }}</span>
            </div>
          </div>
          <div class="col-6">
            <div class="text-gh-muted">Накоплено %</div>
            <div class="fw-semibold money-positive">+{{ formatMoney(getResult(d).accruedInterest) }}</div>
          </div>
          <div class="col-6">
            <div class="text-gh-muted">К дате окончания</div>
            <div class="fw-bold">{{ formatMoney(getResult(d).totalAtEnd) }}</div>
          </div>
        </div>

        <div class="mt-2 text-gh-muted d-flex justify-content-between" style="font-size: 11px;">
          <span>
            <i class="bi bi-calendar-event me-1"></i>
            {{ getResult(d).daysLeft }} дн. до окончания
          </span>
          <span v-if="getResult(d).daysLeft <= 30" class="text-warning fw-semibold">
            <i class="bi bi-exclamation-triangle me-1"></i>Скоро закрывается
          </span>
        </div>
      </div>
    </div>

    <!-- Footer: итоги -->
    <div v-if="activeDeposits.length > 0" class="card-footer p-3" style="background: #f6f8fa;">
      <div class="d-flex justify-content-between" style="font-size: 12px;">
        <span class="text-gh-muted">Всего размещено</span>
        <span class="fw-semibold">{{ formatMoney(totalDeposited) }}</span>
      </div>
      <div class="d-flex justify-content-between" style="font-size: 12px;">
        <span class="text-gh-muted">Итого к получению</span>
        <span class="fw-bold money-positive">{{ formatMoney(totalAtEnd) }}</span>
      </div>
    </div>
  </div>

  <!-- Modal: Добавить / редактировать вклад -->
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ form.id ? 'Редактировать вклад' : 'Добавить вклад' }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Название</label>
              <input v-model="form.name" class="form-control" placeholder="Вклад Сбербанк 2025" />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Сумма</label>
              <div class="input-group">
                <input v-model.number="form.amount" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Годовая ставка</label>
              <div class="input-group">
                <input v-model.number="form.rate" type="number" step="0.01" min="0" class="form-control" />
                <span class="input-group-text">%</span>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Дата открытия</label>
              <input v-model="form.startDate" type="date" class="form-control" />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Дата окончания</label>
              <input v-model="form.endDate" type="date" class="form-control" />
            </div>
            <div class="col-md-6">
              <div class="form-check mt-2">
                <input v-model="form.capitalization" type="checkbox" class="form-check-input" id="capCheck" />
                <label class="form-check-label" for="capCheck">Капитализация процентов</label>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-check mt-2">
                <input v-model="form.autoRenewal" type="checkbox" class="form-check-input" id="renewCheck" />
                <label class="form-check-label" for="renewCheck">Автопролонгация</label>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer justify-content-between">
          <button v-if="form.id" class="btn btn-sm btn-outline-danger" @click="remove(form.id!)">
            <i class="bi bi-trash me-1"></i>Удалить
          </button>
          <div class="ms-auto d-flex gap-2">
            <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Отмена</button>
            <button class="btn btn-sm btn-primary" @click="save">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

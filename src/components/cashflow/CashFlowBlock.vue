<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { useAppStore } from '@/stores/app.store'
import { CashFlowService } from '@/services/cashflow.service'
import { formatMoney } from '@/utils/formatters'
import { currentMonthName } from '@/utils/date-helpers'
import type { IncomeItem, IncomeCategory } from '@/types/income'

const store = useAppStore()

const freelanceOverride = computed(() => {
  const cfg = store.freelanceConfig
  return cfg.linkedIncomeItemId
    ? { itemId: cfg.linkedIncomeItemId, amount: cfg.currentHours * cfg.hourlyRate }
    : null
})

const entries = computed(() =>
  CashFlowService.buildEntries(store.incomeItems, store.deposits, freelanceOverride.value),
)

const totalThisMonth = computed(() => CashFlowService.totalThisMonth(entries.value))
const totalNextMonth = computed(() => CashFlowService.totalNextMonth(entries.value))

const CATEGORY_ICONS: Record<string, string> = {
  salary: 'bi-briefcase',
  rental: 'bi-house',
  freelance: 'bi-code-slash',
  deposit: 'bi-piggy-bank',
  other: 'bi-cash',
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const modalEl = ref<HTMLElement | null>(null)
let modalInstance: Modal | null = null

onMounted(() => {
  if (modalEl.value) modalInstance = new Modal(modalEl.value)
})

const emptyForm = (): Omit<IncomeItem, 'id'> & { id?: string } => ({
  name: '',
  amount: 0,
  dayOfMonth: 1,
  isNextMonth: false,
  category: 'other' as IncomeCategory,
  isActive: true,
})

const form = ref(emptyForm())

function openAdd() {
  form.value = emptyForm()
  modalInstance?.show()
}

function openEdit(id: string) {
  const item = store.incomeItems.find((i) => i.id === id)
  if (!item) return
  form.value = { ...item }
  modalInstance?.show()
}

function save() {
  if (!form.value.name || form.value.amount <= 0) return
  if (form.value.id) {
    store.updateIncomeItem(form.value.id, form.value as IncomeItem)
  } else {
    store.addIncomeItem(form.value as Omit<IncomeItem, 'id'>)
  }
  modalInstance?.hide()
}

function remove(id: string) {
  if (confirm('Удалить этот доход?')) {
    store.removeIncomeItem(id)
    modalInstance?.hide()
  }
}

// Индекс первой записи "следующего месяца" для разделителя
const firstNextMonthIdx = computed(() => entries.value.findIndex((e) => e.isNextMonth))
</script>

<template>
  <div class="card h-100 w-100 d-flex flex-column">
    <!-- Header -->
    <div class="card-header d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-arrow-down-circle text-success"></i>
        <span class="block-title">Поток доходов</span>
      </div>
      <button class="btn btn-sm btn-outline-secondary" @click="openAdd">
        <i class="bi bi-plus"></i>
      </button>
    </div>

    <!-- Список -->
    <div class="card-body p-0 flex-grow-1" style="overflow-y: auto; max-height: 300px;">
      <div v-if="entries.length === 0" class="text-gh-muted text-center py-4" style="font-size: 13px;">
        Нет доходов. Нажмите «+» чтобы добавить.
      </div>

      <ul v-else class="list-group list-group-flush">
        <!-- Заголовок: текущий месяц -->
        <li v-if="entries.some(e => !e.isNextMonth)"
          class="list-group-item py-1 px-3"
          style="background: #f6f8fa; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #656d76; border-bottom: none;">
          {{ currentMonthName() }}
        </li>

        <template v-for="(entry, idx) in entries" :key="entry.id">
          <!-- Заголовок: следующий месяц (перед первой записью) -->
          <li v-if="entry.isNextMonth && idx === firstNextMonthIdx"
            class="list-group-item py-1 px-3 mt-1"
            style="background: #f6f8fa; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #656d76; border-bottom: none;">
            В следующем месяце
          </li>

          <li
            class="list-group-item px-3 py-2 d-flex align-items-center gap-2"
            :class="{
              'opacity-50': CashFlowService.isPast(entry.dayOfMonth) && !entry.isNextMonth,
              'list-group-item-success': CashFlowService.isToday(entry.dayOfMonth) && !entry.isNextMonth,
            }"
          >
            <!-- День месяца -->
            <span
              class="badge rounded-pill flex-shrink-0"
              :class="entry.isNextMonth ? 'bg-light border text-secondary' : 'bg-secondary'"
              style="min-width: 36px; font-size: 11px;"
            >
              {{ entry.dayOfMonth }}
            </span>

            <!-- Иконка -->
            <i :class="['bi', CATEGORY_ICONS[entry.category] ?? 'bi-cash', 'flex-shrink-0', entry.isNextMonth ? 'text-gh-muted' : 'text-success']"
               style="font-size: 13px;"></i>

            <!-- Название -->
            <span class="flex-grow-1 text-truncate" style="font-size: 13px;" :title="entry.name">
              {{ entry.name }}
            </span>

            <!-- Сумма -->
            <span class="d-flex flex-column align-items-end text-nowrap">
              <span
                class="fw-semibold"
                :class="entry.isNextMonth ? 'text-gh-muted' : 'money-positive'"
                style="font-size: 13px;"
              >
                {{ formatMoney(entry.amount) }}
              </span>
              <!-- Если сумма переопределена подработкой — показываем расчёт -->
              <span
                v-if="freelanceOverride && entry.id === freelanceOverride.itemId"
                class="text-gh-muted"
                style="font-size: 10px; line-height: 1.2;"
              >
                <i class="bi bi-clock me-1"></i>{{ store.freelanceConfig.currentHours }}ч × {{ formatMoney(store.freelanceConfig.hourlyRate) }}
              </span>
            </span>

            <!-- Кнопка редакт. (только для обычных доходов, не вкладов) -->
            <button
              v-if="!entry.isDeposit"
              class="btn btn-sm btn-link text-gh-muted p-0 flex-shrink-0"
              style="line-height: 1;"
              @click="openEdit(entry.id)"
            >
              <i class="bi bi-pencil" style="font-size: 11px;"></i>
            </button>
            <span v-else style="width: 20px; display: inline-block;"></span>
          </li>
        </template>
      </ul>
    </div>

    <!-- Footer: итоги -->
    <div class="card-footer p-3" style="background: #f6f8fa;">
      <div class="d-flex justify-content-between align-items-center">
        <span class="text-gh-muted" style="font-size: 12px;">Итого в этом месяце</span>
        <span class="money-positive fw-bold" style="font-size: 15px;">{{ formatMoney(totalThisMonth) }}</span>
      </div>
      <div v-if="totalNextMonth > 0" class="d-flex justify-content-between align-items-center mt-1">
        <span class="text-gh-muted" style="font-size: 12px;">
          <i class="bi bi-arrow-right me-1"></i>В следующем месяце
        </span>
        <span class="text-gh-muted fw-semibold">{{ formatMoney(totalNextMonth) }}</span>
      </div>
    </div>
  </div>

  <!-- Modal: Добавить / редактировать доход -->
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ form.id ? 'Редактировать доход' : 'Добавить доход' }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Название</label>
              <input v-model="form.name" class="form-control" placeholder="Аванс, Зарплата, Аренда..." />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Сумма</label>
              <div class="input-group">
                <input v-model.number="form.amount" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">День месяца</label>
              <input v-model.number="form.dayOfMonth" type="number" min="1" max="31" class="form-control" />
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Категория</label>
              <select v-model="form.category" class="form-select">
                <option value="salary">Зарплата / аванс</option>
                <option value="rental">Аренда</option>
                <option value="other">Прочее</option>
              </select>
            </div>
            <div class="col-12">
              <div class="form-check">
                <input v-model="form.isNextMonth" type="checkbox" class="form-check-input" id="nextMonthCheck" />
                <label class="form-check-label" for="nextMonthCheck">
                  Деньги поступят в следующем месяце
                </label>
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

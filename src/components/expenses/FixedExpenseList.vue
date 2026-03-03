<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import type { FixedExpense, ExpenseCategory } from '@/types/expense'
import { useAppStore } from '@/stores/app.store'
import { formatMoney } from '@/utils/formatters'

const store = useAppStore()

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  utilities: 'Коммуналка',
  communication: 'Связь',
  daily: 'Ежедневные',
  other: 'Прочее',
}

// ─── Modal ────────────────────────────────────────────────────────────────────

const modalEl = ref<HTMLElement | null>(null)
let modalInstance: Modal | null = null

onMounted(() => {
  if (modalEl.value) modalInstance = new Modal(modalEl.value)
})

const emptyForm = (): Omit<FixedExpense, 'id'> => ({
  name: '',
  amount: 0,
  dayOfMonth: 1,
  category: 'other',
  isActive: true,
})

const form = ref<Omit<FixedExpense, 'id'> & { id?: string }>(emptyForm())

function openAdd() {
  form.value = emptyForm()
  modalInstance?.show()
}

function openEdit(expense: FixedExpense) {
  form.value = { ...expense }
  modalInstance?.show()
}

function save() {
  if (!form.value.name || form.value.amount <= 0) return
  if (form.value.id) {
    store.updateFixedExpense(form.value.id, form.value as FixedExpense)
  } else {
    store.addFixedExpense(form.value)
  }
  modalInstance?.hide()
}

function remove(id: string) {
  if (confirm('Удалить этот расход?')) store.removeFixedExpense(id)
}
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-2">
      <span class="text-gh-muted" style="font-size: 12px; text-transform: uppercase; letter-spacing: .04em;">
        Фиксированные расходы
      </span>
      <button class="btn btn-sm btn-outline-secondary" @click="openAdd">
        <i class="bi bi-plus"></i>
      </button>
    </div>

    <div v-if="store.fixedExpenses.filter(e => e.isActive).length === 0"
      class="text-gh-muted text-center py-3" style="font-size: 13px;">
      Нет расходов
    </div>

    <table v-else class="table table-sm table-borderless mb-0">
      <tbody>
        <tr v-for="expense in store.fixedExpenses.filter(e => e.isActive)" :key="expense.id">
          <td class="py-1">
            <span class="badge bg-light text-secondary me-1" style="font-size: 11px;">
              {{ CATEGORY_LABELS[expense.category] }}
            </span>
            {{ expense.name }}
          </td>
          <td class="py-1 text-end text-nowrap text-gh-muted" style="font-size: 12px;">
            {{ expense.dayOfMonth }}-го
          </td>
          <td class="py-1 text-end text-nowrap fw-semibold">
            {{ formatMoney(expense.amount) }}
          </td>
          <td class="py-1 text-end" style="width: 32px;">
            <button class="btn btn-sm btn-link text-gh-muted p-0" @click="openEdit(expense)">
              <i class="bi bi-pencil" style="font-size: 11px;"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Modal -->
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ form.id ? 'Редактировать' : 'Добавить' }} расход</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Название</label>
              <input v-model="form.name" class="form-control" placeholder="Коммунальные услуги" />
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
                <option value="utilities">Коммунальные услуги</option>
                <option value="communication">Связь и интернет</option>
                <option value="daily">Ежедневные расходы</option>
                <option value="other">Прочее</option>
              </select>
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

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { useAppStore } from '@/stores/app.store'
import { SimulationService } from '@/services/simulation.service'
import { formatMoney, formatMonths } from '@/utils/formatters'
import { formatDate, toISODate, today } from '@/utils/date-helpers'
import type { SimulationEarlyPayment } from '@/types/simulation'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()

const modalEl = ref<HTMLElement | null>(null)
let modalInstance: Modal | null = null

onMounted(() => {
  if (modalEl.value) {
    modalInstance = new Modal(modalEl.value, { backdrop: 'static' })
    modalEl.value.addEventListener('hidden.bs.modal', () => emit('close'))
  }
})

watch(
  () => props.visible,
  (val) => {
    if (val) modalInstance?.show()
    else modalInstance?.hide()
  },
)

// ─── Форма ───────────────────────────────────────────────────────────────────

const defaultEp = (): SimulationEarlyPayment => ({
  amount: 50_000,
  startDate: toISODate(today()),
  type: 'reduce-term',
  frequency: 'monthly',
})

const selectedMortgageId = ref(store.mortgages.find((m) => m.isActive)?.id ?? '')
const ep = ref<SimulationEarlyPayment>(defaultEp())

// Инициализируем форму из текущей симуляции, если она активна
watch(
  () => props.visible,
  (val) => {
    if (val && store.simulation.isActive) {
      selectedMortgageId.value = store.simulation.mortgageId
      ep.value = { ...store.simulation.earlyPayment }
    } else if (val) {
      selectedMortgageId.value = store.mortgages.find((m) => m.isActive)?.id ?? ''
      ep.value = defaultEp()
    }
  },
)

const activeMortgages = computed(() => store.mortgages.filter((m) => m.isActive))

const selectedMortgage = computed(() =>
  store.mortgages.find((m) => m.id === selectedMortgageId.value) ?? null,
)

// ─── Предварительный расчёт ───────────────────────────────────────────────────

const comparison = computed(() => {
  if (!selectedMortgage.value || ep.value.amount <= 0) return null
  try {
    return SimulationService.compare(selectedMortgage.value, ep.value)
  } catch {
    return null
  }
})

// ─── Запуск симуляции ────────────────────────────────────────────────────────

function startSimulation() {
  if (!selectedMortgageId.value || ep.value.amount <= 0) return
  store.startSimulation({
    mortgageId: selectedMortgageId.value,
    earlyPayment: { ...ep.value },
  })
  modalInstance?.hide()
}
</script>

<template>
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title d-flex align-items-center gap-2">
            <i class="bi bi-magic text-warning"></i>
            А что если? — Симуляция досрочного погашения
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>

        <div class="modal-body">
          <div class="row g-3">
            <!-- Выбор ипотеки -->
            <div class="col-12">
              <label class="form-label fw-semibold">Ипотека</label>
              <select v-model="selectedMortgageId" class="form-select">
                <option v-for="m in activeMortgages" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
            </div>

            <!-- Сумма досрочного платежа -->
            <div class="col-md-6">
              <label class="form-label fw-semibold">Сумма досрочного платежа</label>
              <div class="input-group">
                <input v-model.number="ep.amount" type="number" min="0" step="1000" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>

            <!-- Дата первого платежа -->
            <div class="col-md-6">
              <label class="form-label fw-semibold">Дата первого платежа</label>
              <input v-model="ep.startDate" type="date" class="form-control" />
            </div>

            <!-- Тип погашения -->
            <div class="col-md-6">
              <label class="form-label fw-semibold">Тип погашения</label>
              <select v-model="ep.type" class="form-select">
                <option value="reduce-term">Уменьшение срока</option>
                <option value="reduce-payment">Уменьшение платежа</option>
              </select>
              <div class="form-text text-gh-muted">
                <span v-if="ep.type === 'reduce-term'">Платёж не меняется — срок сокращается</span>
                <span v-else>Срок не меняется — платёж уменьшается</span>
              </div>
            </div>

            <!-- Периодичность -->
            <div class="col-md-6">
              <label class="form-label fw-semibold">Периодичность</label>
              <select v-model="ep.frequency" class="form-select">
                <option value="once">Разово</option>
                <option value="monthly">Ежемесячно</option>
                <option value="quarterly">Ежеквартально</option>
                <option value="yearly">Ежегодно</option>
              </select>
            </div>

            <!-- Предварительный расчёт -->
            <div v-if="comparison" class="col-12">
              <hr class="my-1" />
              <div class="fw-semibold mb-2" style="font-size: 13px;">
                <i class="bi bi-calculator me-1 text-info"></i>Предварительный расчёт
              </div>

              <div class="row g-2">
                <!-- Было -->
                <div class="col-md-6">
                  <div class="p-3 rounded" style="background: #f6f8fa; border: 1px solid var(--gh-border);">
                    <div class="text-gh-muted fw-semibold mb-2" style="font-size: 11px; text-transform: uppercase; letter-spacing: .04em;">
                      Сейчас (без досрочных)
                    </div>
                    <div class="d-flex justify-content-between mb-1" style="font-size: 13px;">
                      <span class="text-gh-muted">Платёж/мес.</span>
                      <span class="fw-semibold">{{ formatMoney(comparison.originalMonthlyPayment) }}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1" style="font-size: 13px;">
                      <span class="text-gh-muted">Переплата</span>
                      <span class="text-danger fw-semibold">{{ formatMoney(comparison.originalTotalInterest) }}</span>
                    </div>
                    <div class="d-flex justify-content-between" style="font-size: 13px;">
                      <span class="text-gh-muted">Закроется</span>
                      <span class="fw-semibold">{{ formatDate(comparison.originalEndDate) }}</span>
                    </div>
                    <div class="text-gh-muted mt-1" style="font-size: 11px;">
                      {{ formatMonths(comparison.originalTermMonths) }} осталось
                    </div>
                  </div>
                </div>

                <!-- Стало -->
                <div class="col-md-6">
                  <div class="p-3 rounded" style="background: #f0fff4; border: 1px solid #2da44e33;">
                    <div class="text-success fw-semibold mb-2" style="font-size: 11px; text-transform: uppercase; letter-spacing: .04em;">
                      С досрочными платежами
                    </div>
                    <div class="d-flex justify-content-between mb-1" style="font-size: 13px;">
                      <span class="text-gh-muted">Платёж/мес.</span>
                      <span class="fw-semibold">{{ formatMoney(comparison.newMonthlyPayment) }}</span>
                    </div>
                    <div class="d-flex justify-content-between mb-1" style="font-size: 13px;">
                      <span class="text-gh-muted">Переплата</span>
                      <span class="text-success fw-semibold">{{ formatMoney(comparison.newTotalInterest) }}</span>
                    </div>
                    <div class="d-flex justify-content-between" style="font-size: 13px;">
                      <span class="text-gh-muted">Закроется</span>
                      <span class="fw-semibold text-success">{{ formatDate(comparison.newEndDate) }}</span>
                    </div>
                    <div class="text-success mt-1" style="font-size: 11px;">
                      {{ formatMonths(comparison.newTermMonths) }} осталось
                    </div>
                  </div>
                </div>

                <!-- Итог: экономия -->
                <div class="col-12">
                  <div class="p-2 rounded d-flex gap-4 justify-content-center" style="background: #fff8c5; border: 1px solid #d4a017;">
                    <div class="text-center">
                      <div class="text-gh-muted" style="font-size: 11px;">Экономия на процентах</div>
                      <div class="fw-bold text-success" style="font-size: 18px;">
                        {{ formatMoney(comparison.savedInterest) }}
                      </div>
                    </div>
                    <div v-if="comparison.savedMonths > 0" class="text-center">
                      <div class="text-gh-muted" style="font-size: 11px;">Сокращение срока</div>
                      <div class="fw-bold text-primary" style="font-size: 18px;">
                        {{ formatMonths(comparison.savedMonths) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Нет данных -->
            <div v-else-if="selectedMortgage && ep.amount > 0" class="col-12">
              <div class="text-gh-muted text-center py-2" style="font-size: 13px;">
                <i class="bi bi-hourglass me-1"></i>Идёт расчёт...
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer justify-content-between">
          <div class="text-gh-muted" style="font-size: 12px;">
            Данные меняются только в режиме симуляции — оригинал не затронут
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Отмена</button>
            <button
              class="btn btn-sm btn-warning"
              :disabled="!selectedMortgageId || ep.amount <= 0"
              @click="startSimulation"
            >
              <i class="bi bi-magic me-1"></i>Запустить симуляцию
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

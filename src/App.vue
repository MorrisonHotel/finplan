<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app.store'

import AppHeader from '@/components/layout/AppHeader.vue'
import SimulationBanner from '@/components/layout/SimulationBanner.vue'
import SimulationPanel from '@/components/simulation/SimulationPanel.vue'
import SettingsModal from '@/components/layout/SettingsModal.vue'
import CashFlowBlock from '@/components/cashflow/CashFlowBlock.vue'
import FreelanceBlock from '@/components/freelance/FreelanceBlock.vue'
import FreeBalanceBlock from '@/components/balance/FreeBalanceBlock.vue'
import ExpensesBlock from '@/components/expenses/ExpensesBlock.vue'
import DepositsBlock from '@/components/deposits/DepositsBlock.vue'
import GoalsBlock from '@/components/goals/GoalsBlock.vue'
import AIAdvisor from '@/components/ai/AIAdvisor.vue'

const store = useAppStore()
const isSimulation = computed(() => store.simulation.isActive)

const showSimulationPanel = ref(false)
</script>

<template>
  <div class="d-flex flex-column" style="min-height: 100vh;">
    <!-- Header -->
    <AppHeader @open-simulation="showSimulationPanel = true" />

    <!-- Simulation banner -->
    <SimulationBanner v-if="isSimulation" />

    <!-- Simulation panel (modal) -->
    <SimulationPanel :visible="showSimulationPanel" @close="showSimulationPanel = false" />

    <!-- Settings modal -->
    <SettingsModal />

    <!-- Main content -->
    <main class="flex-grow-1 p-3">
      <div class="container-xxl">

        <!-- Row 1: Поток | Возможный доход | Свободный остаток -->
        <div class="row g-3 mb-3" style="min-height: 220px;">
          <div class="col-xl-4 col-lg-4 d-flex">
            <CashFlowBlock class="flex-grow-1" />
          </div>
          <div class="col-xl-4 col-lg-4 d-flex">
            <FreelanceBlock class="flex-grow-1" />
          </div>
          <div class="col-xl-4 col-lg-4 d-flex">
            <FreeBalanceBlock class="flex-grow-1" />
          </div>
        </div>

        <!-- Row 2: Расходы (ипотеки + фикс. расходы) -->
        <div class="row g-3 mb-3">
          <div class="col-12">
            <ExpensesBlock />
          </div>
        </div>

        <!-- Row 3: Вклады | Цели -->
        <div class="row g-3 mb-3" style="min-height: 280px;">
          <div class="col-xl-3 col-lg-4 d-flex">
            <DepositsBlock class="flex-grow-1" />
          </div>
          <div class="col-xl-9 col-lg-8 d-flex">
            <GoalsBlock class="flex-grow-1" />
          </div>
        </div>

        <!-- Row 4: ИИ-советник -->
        <div class="row g-3">
          <div class="col-12">
            <AIAdvisor />
          </div>
        </div>

      </div>
    </main>

    <!-- Footer -->
    <footer class="py-2 px-3 text-gh-muted border-top" style="background: #f6f8fa; font-size: 12px;">
      FinPlan · данные хранятся локально в браузере
    </footer>
  </div>
</template>

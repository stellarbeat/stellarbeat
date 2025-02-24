<template>
  <div class="card">
    <div class="text-muted mx-3 mt-3">Crawler rejected</div>
    <div class="card-body d-flex flex-row justify-content-center p-1">
      <div
        class="canvas-container"
        style="position: relative; height: 150px; width: 150px"
      >
        <canvas id="overLoadedBarChart" ref="overLoadedBarChart"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArcElement,
  BarController,
  BarElement,
  Chart,
  type ChartConfiguration,
  type ChartItem,
  DoughnutController,
  Legend,
  Tooltip,
} from "chart.js";

import Store from "@/store/Store";
import useStore from "@/store/useStore";
import { computed, onBeforeUnmount, onMounted, type Ref, ref } from "vue";

const chart: Ref<Chart<"doughnut", number[], string> | null> = ref(null);

const store: Store = useStore();
const network = store.network;

const overloadedBuckets = computed(() => {
  const buckets: number[] = Array(2).fill(0);
  const bucketReducer = (buckets: number[], overloaded: boolean) => {
    switch (true) {
      case !overloaded:
        buckets[0]++;
        break;
      case overloaded:
        buckets[1]++;
        break;
    }

    return buckets;
  };
  return network.nodes
    .filter((node) => node.active && node.isValidator)
    .map((node) => node.overLoaded)
    .reduce(bucketReducer, buckets);
});

const overLoadedBarChart: Ref<ChartItem | null> = ref(null);
function initializeBarChart() {
  Chart.register(
    BarController,
    BarElement,
    Legend,
    ArcElement,
    DoughnutController,
    Tooltip,
  );
  if (overLoadedBarChart.value === null) return;

  const config: ChartConfiguration<"doughnut", number[], string> = {
    type: "doughnut",
    // The data for our dataset
    data: {
      labels: ["No", "Yes"],
      datasets: [
        {
          label: "nodes",
          backgroundColor: [
            "rgba(25, 151, 198,0.7)", // success blue
            overloadedBuckets.value[0] >= overloadedBuckets.value[1]
              ? "rgba(228, 216, 54, 0.7)"
              : "rgba(205, 32, 31, 0.7)",
          ],
          borderWidth: 0,
          data: overloadedBuckets.value,
        },
      ],
    },

    // Configuration options go here
    options: {
      layout: {
        padding: {
          left: 0,
          right: 0,
        },
      },
      responsive: true,
      maintainAspectRatio: true,
      cutout: "50%",
      plugins: {
        legend: {
          display: true,
          position: "bottom",
        },
      },
      animation: {
        duration: 0, // general animation time
      },
    },
  };
  chart.value = new Chart(overLoadedBarChart.value, config);
}

onMounted(() => {
  initializeBarChart();
});

onBeforeUnmount(() => {
  if (chart.value) {
    chart.value.destroy();
  }
});
</script>

<style scoped></style>

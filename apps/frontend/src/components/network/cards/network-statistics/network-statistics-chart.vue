<template>
  <div class="w-100 h-100">
    <canvas :ref="(el) => (chartElement = el)"> </canvas>
  </div>
</template>

<script setup lang="ts">
import {
  type ActiveElement,
  Chart,
  type ChartEvent,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  TimeSeriesScale,
  type TooltipItem,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { NetworkStatisticsAggregation } from "shared";
import {
  type ComponentPublicInstance,
  onBeforeUnmount,
  onMounted,
  type Ref,
  ref,
} from "vue";

const chart = ref<Chart>();
const emit = defineEmits(["hover"]);
const chartElement: Ref<Element | ComponentPublicInstance | null> = ref(null);

const props = defineProps<{
  yearStatistics: NetworkStatisticsAggregation[];
  statsProperty: string;
}>();

onMounted(() => {
  initializeBarChart();
});

function getAggregatedDataSets(
  statisticsAggregation: NetworkStatisticsAggregation[],
) {
  return [
    {
      fill: "origin",
      tension: 0.5,
      borderColor: "rgba(25, 151, 198,1)",
      backgroundColor: "rgba(25, 151, 198,0.3)", // primary blue
      borderWidth: 2,
      steppedLine: false,
      data: statisticsAggregation.map((stat) => {
        if (stat.crawlCount === 0) return {};
        return {
          x: stat.time,
          //@ts-ignore
          y:
            stat.crawlCount !== 0
              ? //@ts-ignore
                Math.round(stat[props.statsProperty])
              : 0.1,
        };
      }),
    },
  ];
}

function initializeBarChart() {
  Chart.register(
    Filler,
    PointElement,
    LineController,
    LineElement,
    LinearScale,
    TimeScale,
    TimeSeriesScale,
  );

  //@ts-ignore
  chart.value = new Chart(chartElement.value as HTMLCanvasElement, {
    type: "line",
    // The data for our dataset
    data: {
      datasets: getAggregatedDataSets(props.yearStatistics),
    },

    // Configuration options go here
    options: {
      onHover: (event: ChartEvent, activeElements: ActiveElement[]): void => {
        //@ts-ignore
        event.native.target.style.cursor = "pointer";
        if (activeElements.length === 1 && activeElements[0]) {
          emit("hover", props.yearStatistics[activeElements[0].index]);
        } else emit("hover", null);
      },
      hover: {
        mode: "nearest",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
          mode: "index",
          intersect: false,
          caretSize: 0,
          displayColors: false,
          callbacks: {
            title: function () {
              //Return value for title
              return "";
            },
            label: function (tooltipItem: TooltipItem<"line">) {
              return tooltipItem.label + ": " + tooltipItem.formattedValue;
            },
          },
        },
      },
      elements: {
        point: {
          radius: 0,
        },
      },
      layout: {
        padding: {
          left: 0,
          right: 0,
          top: 4,
          bottom: 0,
        },
      },
      responsive: true,
      maintainAspectRatio: false,

      animation: {
        duration: 0, // general animation time
      },
      scales: {
        x: {
          offset: false,
          display: false,
          type: "timeseries",
          time: {
            unit: "year",
            tooltipFormat: "MMM yyyy",
          },
          ticks: {
            stepSize: 1,
          },
        },
        y: {
          display: false,
          ticks: {
            stepSize: 12,
          },
          beginAtZero: false,
        },
      },
    },
  });
}

onBeforeUnmount(() => {
  if (chart.value) {
    chart.value.destroy();
  }
});
</script>

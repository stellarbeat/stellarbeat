<template>
  <div :class="dimmerClass" style="height: 100%">
    <div class="loader"></div>
    <div class="dimmer-content svg-wrapper h-100">
      <svg
        ref="graphSvg"
        class="graph"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <g ref="grid">
          <g v-if="!isLoading && viewGraph">
            <path
              v-for="edge in viewGraph.regularEdges.filter(
                (mEdge) =>
                  (!mEdge.isFailing || optionShowFailingEdges) &&
                  (mEdge.isPartOfTransitiveQuorumSet ||
                    !optionTransitiveQuorumSetOnly),
              )"
              :id="edge.key"
              :key="edge.key"
              class="edge"
              :d="getEdgePath(edge)"
              :class="getEdgeClassObject(edge)"
            >
              <!-- Define the dot -->
            </path>
            <g v-if="propagationEnabled">
              <circle
                v-for="edge in viewGraph.regularEdges.filter(
                  (mEdge) =>
                    (!mEdge.isFailing || optionShowFailingEdges) &&
                    (mEdge.isPartOfTransitiveQuorumSet ||
                      !optionTransitiveQuorumSetOnly),
                )"
                :id="'propagation:' + edge.key"
                :key="'propagation:' + edge.key"
                visibility="hidden"
                r="5"
                class="propagation-circle"
              >
                <!-- Animate the dot along the path -->
                <animateMotion
                  begin="indefinite"
                  dur="1s"
                  repeatCount="1"
                  fill="freeze"
                >
                  <mpath :href="'#' + edge.key" />
                </animateMotion>
                <animate
                  id="radiusAnimation"
                  attributeName="r"
                  begin="indefinite"
                  dur="0.5s"
                  from="5"
                  to="10"
                />
              </circle>
            </g>
            <!-- Define the dot -->

            <path
              v-for="edge in viewGraph.stronglyConnectedEdges.filter(
                (mEdge) =>
                  (!mEdge.isFailing || optionShowFailingEdges) &&
                  (mEdge.isPartOfTransitiveQuorumSet ||
                    !optionTransitiveQuorumSetOnly),
              )"
              :key="edge.key"
              class="edge"
              :d="getEdgePath(edge)"
              :class="getEdgeClassObject(edge)"
            />
            <g
              v-if="
                selectedVertices &&
                selectedVertices.length > 0 &&
                optionHighlightTrustingNodes
              "
            >
              <path
                v-for="edge in viewGraph.trustingEdges.filter(
                  (mEdge) =>
                    (!mEdge.isFailing || optionShowFailingEdges) &&
                    (mEdge.isPartOfTransitiveQuorumSet ||
                      !optionTransitiveQuorumSetOnly),
                )"
                :key="edge.key + edge.key"
                class="edge incoming"
                :d="getEdgePath(edge)"
              />
            </g>
            <g
              v-if="
                selectedVertices &&
                selectedVertices.length > 0 &&
                optionHighlightTrustedNodes
              "
            >
              <path
                v-for="edge in viewGraph.trustedEdges.filter(
                  (mEdge) =>
                    (!mEdge.isFailing || optionShowFailingEdges) &&
                    (mEdge.isPartOfTransitiveQuorumSet ||
                      !optionTransitiveQuorumSetOnly),
                )"
                :key="edge.key + edge.key"
                class="edge outgoing"
                :d="getEdgePath(edge)"
              />
            </g>
            <graph-strongly-connected-component
              :greatest="true"
              :vertex-coordinates="viewGraph.transitiveQuorumSetCoordinates"
            />
            <g v-if="!optionTransitiveQuorumSetOnly">
              <graph-strongly-connected-component
                v-for="(
                  sccCoordinates, index
                ) in viewGraph.stronglyConnectedComponentCoordinates"
                :key="index"
                :vertex-coordinates="sccCoordinates"
              />
            </g>
            <g
              v-for="vertex in Array.from(
                viewGraph.viewVertices.values(),
              ).filter(
                (mVertex) =>
                  mVertex.isPartOfTransitiveQuorumSet ||
                  !optionTransitiveQuorumSetOnly,
              )"
              :key="vertex.key"
              :transform="getVertexTransform(vertex)"
              class="vertex"
              style="cursor: pointer"
              @click="
                vertexSelected(vertex);
                startPropagationAnimation(vertex.key);
              "
            >
              <circle :r="5" :class="getVertexClassObject(vertex)">
                <title>{{ vertex.label }}</title>
              </circle>
              <g>
                <rect
                  style="fill: white; opacity: 0.7; text-transform: lowercase"
                  :width="getVertexTextRectWidthPx(vertex)"
                  height="13px"
                  y="10"
                  :x="getVertexTextRectX(vertex)"
                  rx="2"
                  :class="{
                    'rect-selected': vertex.selected,
                    rect: !vertex.selected,
                  }"
                ></rect>
                <text
                  y="5"
                  :class="getVertexTextClass(vertex)"
                  dy="1.3em"
                  text-anchor="middle"
                  font-size="12px"
                >
                  {{ truncate(vertex.label, 10) }}
                  <title>{{ vertex.label }}</title>
                </text>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { zoom, zoomIdentity } from "d3-zoom";
import { select, selectAll, type Selection } from "d3-selection";
import GraphStronglyConnectedComponent from "@/components/visual-navigator/graph/graph-strongly-connected-component.vue";
import ViewVertex from "@/components/visual-navigator/graph/view-vertex";
import ViewGraph from "@/components/visual-navigator/graph/view-graph";
import ViewEdge from "@/components/visual-navigator/graph/view-edge";
import { isObject } from "shared";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  type PropType,
  ref,
  toRefs,
  watch,
} from "vue";
import { useTruncate } from "@/composables/useTruncate";

const props = defineProps({
  centerVertex: {
    type: Object as PropType<ViewVertex>,
    required: false,
    default: null,
  },
  selectedVertices: {
    type: Array as PropType<ViewVertex[]>,
    required: true,
  },
  optionShowFailingEdges: {
    type: Boolean,
    required: true,
  },
  optionHighlightTrustingNodes: {
    type: Boolean,
    required: true,
  },
  optionHighlightTrustedNodes: {
    type: Boolean,
    required: true,
  },
  optionShowRegularEdges: {
    type: Boolean,
    required: true,
  },
  optionTransitiveQuorumSetOnly: {
    type: Boolean,
    required: true,
  },
  fullScreen: {
    type: Boolean,
    required: true,
  },
  zoomEnabled: {
    type: Boolean,
    required: true,
    default: false,
  },
  viewGraph: {
    type: Object as PropType<ViewGraph>,
    required: true,
  },
  initialZoom: {
    type: Number,
    required: false,
    default: 1,
  },
  propagationEnabled: {
    type: Boolean,
    required: false,
    default: false,
  },
});

const {
  centerVertex,
  fullScreen,
  zoomEnabled,
  selectedVertices,
  viewGraph,
  optionHighlightTrustingNodes,
  optionHighlightTrustedNodes,
  optionShowFailingEdges,
} = toRefs(props);
let computeGraphWorker: Worker;
const isLoading = ref(true);
const emit = defineEmits(["vertex-selected"]);
const truncate = useTruncate();

let d3svg: Selection<Element, null, null, undefined>;
let d3Grid: Selection<Element, null, null, undefined>;

let graphZoom: any;

watch(
  () => props.centerVertex,
  () => {
    centerCorrectVertex();
  },
);

watch(selectedVertices, () => {
  viewGraph?.value?.reClassifyEdges(
    selectedVertices.value.map((vertex) => vertex.key),
  );
  viewGraph?.value?.reClassifyVertices(
    selectedVertices.value.map((vertex) => vertex.key),
  );
});
watch(viewGraph, () => {
  isLoading.value = true;
  computeGraphWorker.postMessage({
    width: width(),
    height: height(),
    vertices: Array.from(viewGraph.value.viewVertices.values()),
    edges: Array.from(viewGraph.value.viewEdges.values()),
  });
});

watch(fullScreen, () => {
  centerCorrectVertex();
  transformAndZoom();
});

watch(isLoading, () => {
  centerCorrectVertex();
});

function vertexSelected(vertex: ViewVertex) {
  emit("vertex-selected", vertex);
}

function getVertexTransform(vertex: ViewVertex): string {
  return `translate(${vertex.x},${vertex.y})`;
}

function getVertexTextRectWidth(vertex: ViewVertex) {
  return (truncate(vertex.label, 10).length / 10) * 60;
}

function getVertexTextRectWidthPx(vertex: ViewVertex) {
  return getVertexTextRectWidth(vertex) + "px";
}

function getVertexTextRectX(vertex: ViewVertex) {
  return "-" + getVertexTextRectWidth(vertex) / 2 + "px";
}

function getVertexTextClass(vertex: ViewVertex) {
  return {
    active: !vertex.isFailing,
    failing: vertex.isFailing,
    selected: vertex.selected,
  };
}

function getVertexClassObject(vertex: ViewVertex) {
  return {
    active: !vertex.isFailing,
    selected: vertex.selected,
    failing: vertex.isFailing,
    target: highlightVertexAsIncoming(vertex) && !vertex.selected,
    source:
      highlightVertexAsOutgoing(vertex) &&
      !vertex.selected &&
      !highlightVertexAsIncoming(vertex),
    transitive: vertex.isPartOfTransitiveQuorumSet,
  };
}

function highlightVertexAsOutgoing(vertex: ViewVertex) {
  if (selectedVertices?.value.length <= 0) return false;
  const edges = selectedVertices?.value
    .map((selectedVertex) =>
      viewGraph?.value.viewEdges.get(vertex.key + ":" + selectedVertex.key),
    )
    .filter((edge) => edge !== undefined);
  const allEdgesAreFailing = edges.every(
    (edge) => (edge as ViewEdge).isFailing,
  );

  if (edges.length <= 0) return false;

  return (
    vertex.isTrustingSelectedVertex &&
    optionHighlightTrustingNodes?.value &&
    (!allEdgesAreFailing || optionShowFailingEdges?.value)
  );
}

function highlightVertexAsIncoming(vertex: ViewVertex) {
  if (selectedVertices?.value.length <= 0) return false;

  const edges = selectedVertices?.value
    .map((selectedVertex) =>
      viewGraph?.value.viewEdges.get(selectedVertex.key + ":" + vertex.key),
    )
    .filter((edge) => edge !== undefined);
  const allEdgesAreFailing = edges.every(
    (edge) => (edge as ViewEdge).isFailing,
  );

  if (edges.length <= 0) return false;

  return (
    vertex.isTrustedBySelectedVertex &&
    optionHighlightTrustedNodes?.value &&
    (!allEdgesAreFailing || optionShowFailingEdges?.value)
  );
}

const graphSvg = ref<SVGElement | null>(null);

function width() {
  return (graphSvg.value as SVGElement).clientWidth;
}

function height() {
  return (graphSvg.value as SVGElement).clientHeight;
}

const dimmerClass = computed(() => {
  return {
    dimmer: true,
    active: isLoading?.value,
  };
});

function centerCorrectVertex() {
  if (centerVertex?.value instanceof ViewVertex) {
    const realVertexX = -centerVertex.value.x + width() / 2;
    const realVertexY = -centerVertex.value.y + height() / 2;

    const transform = zoomIdentity.translate(realVertexX, realVertexY).scale(1);
    d3svg.call(graphZoom.transform, transform);
  }
}
function mapViewGraph(vertices: ViewVertex[], edges: ViewEdge[]) {
  vertices.forEach((updatedVertex: ViewVertex) => {
    const vertex = viewGraph.value.viewVertices.get(updatedVertex.key);
    if (!vertex) return;
    vertex.x = updatedVertex.x;
    vertex.y = updatedVertex.y;
  });

  edges.forEach((updatedEdge: ViewEdge) => {
    const edge = viewGraph.value.viewEdges.get(updatedEdge.key);
    if (!edge) return;
    edge.source = updatedEdge.source;
    edge.target = updatedEdge.target;
  });
}

const grid = ref<Element | null>(null);

onMounted(() => {
  const workerType = import.meta.env.DEV ? "module" : "classic";
  computeGraphWorker = new Worker(
    new URL("./../../../workers/compute-graphv9.worker.ts", import.meta.url),
    {
      type: workerType,
      /* @vite-ignore */
    },
  );
  computeGraphWorker.onmessage = (event: {
    data: { type: string; vertices: ViewVertex[]; edges: ViewEdge[] };
  }) => {
    if (event.data.type === "end") {
      {
        mapViewGraph(event.data.vertices, event.data.edges);
        isLoading.value = false;
      }
    }
  };

  d3Grid = select(grid.value as Element);
  d3svg = select(graphSvg.value as Element);
  graphZoom = zoom()
    .filter((event) => {
      //mouse scrolling interferes with zoom,
      //that is why it has to be explicitly enabled
      if (!zoomEnabled.value && event.type === "wheel") {
        return false;
      }
      return true;
    })
    .on("zoom", (event) => {
      d3Grid.attr("transform", event.transform);
    })
    .scaleExtent([1, 3]);
  transformAndZoom();
});

function transformAndZoom() {
  d3svg.call(graphZoom);
}

function getEdgeClassObject(edge: ViewEdge) {
  return {
    "strongly-connected": edge.isPartOfStronglyConnectedComponent,
    failing: edge.isFailing,
  };
}

function getEdgePath(edge: ViewEdge) {
  if (!isObject(edge.source))
    throw new Error("Edge source not transformed into object by D3");
  if (!isObject(edge.target))
    throw new Error("Edge target not transformed into object by D3");
  return (
    "M" +
    edge.source.x +
    " " +
    edge.source.y +
    " L" +
    edge.target.x +
    " " +
    edge.target.y
  );
}

function startPropagationAnimation(key: string) {
  const circles = selectAll(`.propagation-circle[id^='propagation:${key}:']`);
  circles.each(function () {
    const circle = select(this);
    //@ts-ignore
    const motionAnimation = this.querySelector("animateMotion");
    //@ts-ignore
    const radiusAnimation = this.querySelector("#radiusAnimation");
    if (motionAnimation) {
      // Set the circle to visible when the animation starts
      circle.style("visibility", "visible");
      motionAnimation.beginElement();

      // Start the radius animation when the motion animation ends
      motionAnimation.addEventListener("endEvent", function () {
        if (radiusAnimation) {
          radiusAnimation.beginElement();
          radiusAnimation.addEventListener("endEvent", function () {
            circle.style("visibility", "hidden");
          });
        }
      });
    }
  });
}

onBeforeUnmount(() => {
  computeGraphWorker.terminate();
});
</script>

<style lang="scss" scoped>
@import "@/assets/variables";

svg.graph {
  width: 100%;
  cursor: grab;
}

.dimmer.active .dimmer-content {
  opacity: 0.4;
}

path.edge {
  stroke: $graph-primary;
  stroke-width: 0.5px;
  stroke-opacity: 0.07;
  fill-opacity: 0;
}

path.strongly-connected {
  stroke: $graph-primary;
  stroke-width: 0.7px;
  stroke-opacity: 0.25;
}

path.failing {
  stroke: $red;
}

path.outgoing {
  stroke: #fec601;
  stroke-opacity: 0.9;
  stroke-width: 1.3px;
}

path.incoming {
  stroke: #73bfb8;
  stroke-opacity: 0.9;
  stroke-width: 1.3px;
}

circle.active {
  fill: $graph-primary;
}

circle.transitive {
  fill: $graph-primary;
}

circle.selected {
  stroke: $yellow;
  opacity: 0.6;
}

circle.failing {
  fill: $red;
}

circle.target {
  stroke: #fec601;
  stroke-opacity: 1;
}

circle.source {
  stroke: #73bfb8;
  stroke-opacity: 1;
}

circle {
  stroke: $white;
  fill: $gray-100;
  cursor: pointer;
  stroke-width: 1.5px;
}

text {
  fill: $graph-primary;
  font-weight: 400;
}

.failing {
  fill: $red;
  opacity: 0.7;
}

.selected {
  font-weight: bold;
}

.rect {
  opacity: 0.8;
}

.rect-selected {
  stroke: yellow;
  stroke-width: 1.5;
}
.propagation-circle {
  fill: $graph-primary;
  opacity: 0.5;
  stroke: $graph-primary;
  stroke-width: 0.5px;
  stroke-opacity: 0.5;
}
</style>

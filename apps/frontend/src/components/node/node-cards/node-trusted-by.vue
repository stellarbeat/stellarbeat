<template>
  <div class="card">
    <div class="card-header">
      <h1 class="card-title">
        Trusted by
        <b-badge variant="success">{{ nodes.length }}</b-badge> nodes
      </h1>
    </div>
    <nodes-table :nodes="nodes" :fields="fields" :per-page="5" />
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { Node } from "shared";
import NodesTable, { type TableNode } from "@/components/node/nodes-table.vue";
import { BBadge } from "bootstrap-vue";
import useStore from "@/store/useStore";

const props = defineProps<{
  node: Node;
}>();

const store = useStore();
const network = store.network;

const fields = computed(() => {
  const fields = [{ key: "name", label: "Node", sortable: true }];

  if (!store.isSimulation)
    fields.push({ key: "index", label: "index", sortable: true });

  fields.push({
    key: "action",
    label: "",
    sortable: false,
    //@ts-ignore
    tdClass: "action",
  });
  return fields;
});

const nodes = computed(() => {
  return network.getTrustingNodes(props.node).map((validator) => {
    const mappedNode: TableNode = {
      isFullValidator: validator.isFullValidator,
      name: validator.displayName,
      publicKey: validator.publicKey,
      index: validator.index,
      validating: validator.isValidating,
    };
    return mappedNode;
  });
});
</script>

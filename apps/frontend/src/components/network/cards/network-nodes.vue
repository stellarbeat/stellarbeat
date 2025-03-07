<template>
  <div class="card">
    <div class="card-header pl-3">
      <h1 class="card-title">
        <b-badge variant="success">{{ numberOfActiveNodes }}</b-badge>
        active
        {{ store.includeAllNodes ? "nodes" : "validators" }}
      </h1>
      <div class="card-options">
        <form>
          <div class="input-group">
            <input
              v-model="filter"
              type="text"
              class="form-control form-control-sm"
              placeholder="Search"
              name="s"
            />
            <div class="input-icon-addon">
              <b-icon-search />
            </div>
          </div>
        </form>
      </div>
    </div>
    <nodes-table
      :filter="filter"
      :nodes="validators"
      :fields="fields"
      :per-page="5"
      :sort-by="'index'"
      :sort-by-desc="true"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import NodesTable, { type TableNode } from "@/components/node/nodes-table.vue";
import { BBadge, BIconSearch } from "bootstrap-vue";
import useStore from "@/store/useStore";

const store = useStore();
const network = store.network;

const filter = ref("");

const fields = computed(() => {
  const fields = [{ key: "name", label: "Node", sortable: true }];

  if (store.networkContext.enableIndex && !store.isSimulation) {
    fields.push({ key: "index", label: "Index", sortable: true });
  }

  fields.push({
    key: "action",
    label: "",
    sortable: false,
    //@ts-ignore
    tdClass: "action",
  });

  return fields;
});

const numberOfActiveNodes = computed(() => {
  if (store.includeAllNodes)
    return network.nodes.filter((node) => !network.isNodeFailing(node)).length;
  else
    return network.nodes.filter(
      (node) => node.isValidator && !network.isNodeFailing(node),
    ).length;
});

const validators = computed(() => {
  return network.nodes
    .filter((node) => node.isValidator || store.includeAllNodes)
    .map((node) => {
      const mappedNode: TableNode = {
        name: node.displayName,
        index: node.index,
        isFullValidator: node.isFullValidator,
        publicKey: node.publicKey,
        validating: node.isValidating,
      };
      return mappedNode;
    });
});
</script>

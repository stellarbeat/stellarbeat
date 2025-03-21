<template>
  <div>
    <b-form-input
      id="searchInput"
      v-model="filter"
      class="form-control search mr-0"
      type="text"
      placeholder="Type name, ... to search"
    />
    <b-table
      striped
      hover
      responsive
      :items="organizations"
      :fields="fields"
      :sort-by.sync="sortBy"
      :sort-desc.sync="sortDesc"
      :per-page="perPage"
      :filter="filter"
      selectable
      :select-mode="mode"
      :current-page="currentPage"
      selected-variant="success"
      @filtered="onFiltered"
      @row-selected="rowSelected"
    >
      <template #cell(name)="row">
        <span
          v-if="row.item.hasReliableUptime"
          v-tooltip.hover="'>99% uptime and at least 3 validators'"
          class="badge sb-badge badge-success full-validator-badge pt-1 mr-1"
          title=">99% uptime and at least 3 validators"
        >
          <b-icon-shield />
        </span>
        {{ row.item.name }}
      </template>
    </b-table>

    <b-pagination
      ref="paginator"
      v-model="currentPage"
      :total-rows="totalRows"
      :per-page="perPage"
      class="my-1"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

import { Node, Organization } from "shared";
import { BFormInput, BIconShield, BPagination, BTable } from "bootstrap-vue";

const props = defineProps<{
  organizations: Organization[];
}>();

const emit = defineEmits(["organizations-selected"]);

const mode = ref("multi");
const sortBy = ref("index");
const sortDesc = ref(true);
const perPage = ref(10);
const currentPage = ref(1);
const filter = ref("");
const totalRows = ref(1);
const fields = ref([
  { key: "name", sortable: true },
  { key: "availability", sortable: true, label: "30D availability" },
]);

function rowSelected(items: Node[]) {
  emit("organizations-selected", items);
}

const onFiltered = (filteredItems: unknown[]) => {
  totalRows.value = filteredItems.length;
  currentPage.value = 1;
};

onMounted(() => {
  // Set the initial number of items
  totalRows.value = props.organizations.length;
});
</script>

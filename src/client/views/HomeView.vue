<script setup lang="js">
import SearchBar from "../components/SearchBar.vue"
import LookupHint from "../components/LookupHint.vue"
import { ref } from "vue"
import _ from "lodash"
 
const lookupUri = ref()

function onInspect(raw) {
  lookupUri.value = !_.isEmpty(raw) ? raw : undefined
}

function onSearch(query) {
  window.location = window.location + `search?${new URLSearchParams(query)}`
}

</script>

<template>
  <section class="hero__wrapper">
    <section class="hero">
      <h2 class="hero__title">
        BARTOC Search <small class="hero__subtitle">prototype for testing</small>
      </h2>
      <div class="hero__search">
        <SearchBar
          @lookup-uri="onInspect"
          @search="onSearch" />
      </div>
      <LookupHint
        v-if="lookupUri"
        :uri="lookupUri.uri"
        :name="lookupUri.name" />
    </section>
  </section>
</template>
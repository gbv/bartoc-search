<script setup lang="js">
import SearchBar from "../components/SearchBar.vue"
import { ref } from "vue"
const lookupUri = ref()
import _ from "lodash"
 

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
        <div
          v-if="lookupUri" 
          class="lookup-message">
          <div class="lookup-message__uri">
            {{ lookupUri.uri }}
          </div>
          <div>is likely an URI from</div>
          <div class="lookup-message__name">
            {{ lookupUri.name }}
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<style>
.lookup-message {
  color: var(--black);
  display: flex;
  justify-content: center;
  flex-direction: column;
}

.lookup-message__uri {
  background: #ff9;
}

.lookup-message__name {
  font-weight: bold;
}

</style>
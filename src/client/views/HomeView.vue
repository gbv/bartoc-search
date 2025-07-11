<script setup lang="js">
import SearchBar from '../components/SearchBar.vue'

function onSearch(query) {
  window.location = window.location + `search?${new URLSearchParams(query)}`
}
</script>

<template>
  <section class="hero__wrapper">
    <section class="hero">
      <h1 class="hero__title">
        BARTOC Search <small class="hero__subtitle">prototype for testing</small>
      </h1>
      <div class="hero__search">
        <SearchBar @search="onSearch" />
      </div>
    </section>
  </section>
</template>


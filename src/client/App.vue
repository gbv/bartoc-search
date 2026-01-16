<template>
  <TheHeader />
  <main>
    <RouterView />
    <BackToTop />
  </main>
  <TheFooter />
</template>

<script setup lang="js">
import TheHeader from "./components/TheHeader.vue"
import TheFooter from "./components/TheFooter.vue"
import BackToTop from "./components/BackToTop.vue"
import { RouterView } from "vue-router"
</script>

<template>
  <header class="header">
    <div class="header__container">
      <div class="header__logo">
        <RouterLink to="/">Bartoc Search</RouterLink>
      </div>
      <nav class="header__nav">
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
        <!-- Add more links as needed -->
      </nav>
      <!-- Optional: Add a search bar or language switcher here -->
      <!-- <div class="header__search">...</div> -->
    </div>
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>
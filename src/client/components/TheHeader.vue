<template>
  <header class="header">
    <div class="header__container">
      <div class="header__logo no-hover">
        <a href="/">
          <img
            :src="logoUrl"
            alt="BARTOC Search"
            class="header__logo-image">
        </a>
      </div>
    </div>
  </header>
</template>

<script setup>
import logoUrl from "../assets/bartoc-logo.svg"
</script>

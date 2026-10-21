<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"

const isVisible = ref(false)
const viewportStyle = ref({})
const SCROLL_TRIGGER = 250 // px before we show the button

// Keep the fixed button inside the visible viewport when the page is zoomed.
function updateViewport() {
  const viewport = window.visualViewport
  viewportStyle.value = viewport ? {
    right: `calc(var(--cc-space-lg) + ${Math.max(0, window.innerWidth - viewport.offsetLeft - viewport.width)}px)`,
    bottom: `calc(var(--cc-space-lg) + ${Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height)}px)`,
  } : {}
}

function handleScroll() {
  if (typeof window === "undefined") {
    return
  }
  const y = Math.max(window.scrollY || window.pageYOffset || 0, window.visualViewport?.pageTop || 0)
  isVisible.value = y > SCROLL_TRIGGER
}

function handleViewportChange() {
  handleScroll()
  updateViewport()
}

function scrollToTop() {
  if (typeof window === "undefined") {
    return
  }
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  })
}

onMounted(() => {
  if (typeof window === "undefined") {
    return
  }
  window.addEventListener("scroll", handleScroll, { passive: true })
  window.addEventListener("resize", handleViewportChange, { passive: true })
  window.visualViewport?.addEventListener("scroll", handleViewportChange, { passive: true })
  window.visualViewport?.addEventListener("resize", handleViewportChange, { passive: true })
  handleViewportChange()
})

onBeforeUnmount(() => {
  if (typeof window === "undefined") {
    return
  }
  window.removeEventListener("scroll", handleScroll)
  window.removeEventListener("resize", handleViewportChange)
  window.visualViewport?.removeEventListener("scroll", handleViewportChange)
  window.visualViewport?.removeEventListener("resize", handleViewportChange)
})
</script>

<template>
  <button
    v-if="isVisible"
    type="button"
    class="cc-button cc-button-primary cc-button-icon back-to-top noprint"
    :style="viewportStyle"
    aria-label="Back to top"
    @click="scrollToTop">
    <font-awesome-icon
      icon="chevron-up"
      size="xl" />
  </button>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  right: var(--cc-space-lg);
  bottom: var(--cc-space-lg);
  z-index: 80;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  box-shadow: var(--cc-shadow-lg);

  /* small appear animation */
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}

/* optional hover/focus style */
.back-to-top:hover,
.back-to-top:focus-visible {
  outline-offset: 2px;
}     
</style>

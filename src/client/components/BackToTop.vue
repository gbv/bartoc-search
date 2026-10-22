<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"

const isVisible = ref(false)
const viewportStyle = ref({})
const SCROLL_TRIGGER = 250 // px before we show the button

// Keep the fixed button inside the visible viewport when the page is zoomed.
function updateViewport() {
  const viewport = window.visualViewport
  const isMobile = window.matchMedia("(max-width: 47.99rem)").matches
  const rightSpacing = isMobile ? "var(--cc-space-md)" : "var(--cc-space-lg)"
  const legalTop = isMobile
    ? document.querySelector(".bartoc-footer__legal")?.getBoundingClientRect().top
    : undefined
  // Lift the button above the footer's legal text when scrolling to the bottom.
  const legalClearance = legalTop != null && legalTop >= 0
    ? Math.max(0, window.innerHeight - legalTop)
    : 0
  viewportStyle.value = viewport ? {
    right: `calc(${rightSpacing} + ${Math.max(0, window.innerWidth - viewport.offsetLeft - viewport.width)}px)`,
    bottom: `max(calc(var(--cc-space-lg) + ${Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height)}px), calc(${legalClearance}px + var(--cc-space-sm)))`,
  } : {
    right: rightSpacing,
    bottom: `max(var(--cc-space-lg), calc(${legalClearance}px + var(--cc-space-sm)))`,
  }
}

function handleScroll() {
  if (typeof window === "undefined") {
    return
  }
  const y = Math.max(window.scrollY || window.pageYOffset || 0, window.visualViewport?.pageTop || 0)
  isVisible.value = y > SCROLL_TRIGGER
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
  window.addEventListener("resize", handleScroll, { passive: true })
  window.visualViewport?.addEventListener("scroll", handleScroll, { passive: true })
  window.visualViewport?.addEventListener("resize", handleScroll, { passive: true })
  handleScroll()
})

onBeforeUnmount(() => {
  if (typeof window === "undefined") {
    return
  }
  window.removeEventListener("scroll", handleScroll)
  window.removeEventListener("resize", handleScroll)
  window.visualViewport?.removeEventListener("scroll", handleScroll)
  window.visualViewport?.removeEventListener("resize", handleScroll)
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

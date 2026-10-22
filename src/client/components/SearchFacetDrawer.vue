<template>
  <aside
    v-if="showSidebar || hasOpened"
    id="mobile-facets-panel"
    class="search-sidebar__area noprint"
    :class="{ 'search-sidebar__area--mobile-open': open }"
    :style="viewportStyle"
    :role="open ? 'dialog' : undefined"
    :aria-modal="open ? 'true' : undefined"
    :aria-label="open ? 'Search filters' : undefined">
    <div
      class="mobile-facets-backdrop"
      @click="emit('close')" />
    <div
      ref="panel"
      class="mobile-facets-panel">
      <header
        v-if="hasOpened"
        class="mobile-facets-panel__header">
        <button
          ref="backButton"
          class="cc-button mobile-facets-back"
          type="button"
          @click="emit('close')">
          <span aria-hidden="true">‹</span>
          Back
        </button>
      </header>
      <div class="mobile-facets-panel__body">
        <SearchSidebar
          v-if="showSidebar || open"
          :facets="facets"
          :loading="loading"
          @modal-toggle="onModalToggle"
          @update-filters="(filters, options) => emit('update-filters', filters, options)" />
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue"
import SearchSidebar from "./SearchSidebar.vue"

const props = defineProps({
  open: { type: Boolean, default: false },
  facets: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  showSidebar: { type: Boolean, default: false },
  returnFocusTo: { type: Object, default: null },
})

const emit = defineEmits(["close", "modal-toggle", "update-filters"])
const viewportStyle = ref({})
const backButton = ref(null)
const panel = ref(null)
let modalOpener = null
// Keep the panel mounted after its first opening so the closing slide can finish.
const hasOpened = ref(props.open)
const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

// A zoomed mobile page can have a wider layout viewport than visible screen.
function updateViewport() {
  const viewport = window.visualViewport
  viewportStyle.value = viewport
    ? { left: `${viewport.offsetLeft}px`, width: `${viewport.width}px` }
    : {}
}

function onKeydown(event) {
  // FacetGroup teleports its "see all" dialog to the page body.
  const activeDialog = document.querySelector(".facet-modal[aria-modal='true']") || panel.value
  if (event.key === "Escape") {
    if (activeDialog === panel.value) {
      emit("close")
    }
    return
  }
  if (event.key !== "Tab" || !activeDialog) {
    return
  }

  const focusable = activeDialog.querySelectorAll(focusableSelector)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const focused = document.activeElement

  if (!activeDialog.contains(focused) || (event.shiftKey && focused === first)) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus()
  } else if (!event.shiftKey && focused === last) {
    event.preventDefault()
    first?.focus()
  }
}

// Put focus inside the facet dialog, then return it to "see all" on close.
async function onModalToggle(field) {
  emit("modal-toggle", field)
  if (!props.open) {
    return
  }

  if (field) {
    modalOpener = document.activeElement
    await nextTick()
    document.querySelector(".facet-modal[aria-modal='true'] .facet-modal-close")?.focus()
  } else {
    await nextTick()
    modalOpener?.focus()
    modalOpener = null
  }
}

// A desktop resize returns the drawer to its sidebar layout.
function onWindowResize() {
  if (window.innerWidth > 767) {
    viewportStyle.value = {}
    if (props.open) {
      emit("close")
    }
  } else if (props.open) {
    updateViewport()
  }
}

// Vue runs the cleanup on close and unmount, restoring the page and listeners.
watch(() => props.open, async (open, wasOpen, onCleanup) => {
  if (typeof window === "undefined") {
    return
  }

  if (!open) {
    if (wasOpen) {
      // Keep the viewport position during slide-out, then return focus.
      await nextTick()
      if (!props.open) {
        props.returnFocusTo?.focus()
      }
    }
    return
  }

  hasOpened.value = true
  updateViewport()
  const previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = "hidden"
  window.addEventListener("keydown", onKeydown)
  window.visualViewport?.addEventListener("resize", updateViewport)
  window.visualViewport?.addEventListener("scroll", updateViewport)

  onCleanup(() => {
    document.body.style.overflow = previousBodyOverflow
    window.removeEventListener("keydown", onKeydown)
    window.visualViewport?.removeEventListener("resize", updateViewport)
    window.visualViewport?.removeEventListener("scroll", updateViewport)
  })

  await nextTick()
  if (props.open) {
    backButton.value?.focus()
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener("resize", onWindowResize, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", onWindowResize)
})
</script>

<style scoped>
.search-sidebar__area {
  --facets-transition-duration: 350ms;

  grid-area: sidebar;
  min-width: 320px;
}

.mobile-facets-backdrop,
.mobile-facets-panel__header {
  display: none;
}

@media (min-width: 768px) {
  .search-sidebar__area {
    /* The search grid ends before the footer, so sticky facets stop there. */
    position: sticky;
    top: var(--cc-space-lg);
    max-height: calc(100vh - var(--cc-space-xxl));
    overflow-y: auto;
  }
}

@media (max-width: 767px) {
  .search-sidebar__area {
    display: block;
    position: fixed;
    inset-block: 0;
    left: 0;
    z-index: 100;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    min-width: 0;
    visibility: hidden;
    pointer-events: none;
    transition: visibility 0s linear var(--facets-transition-duration);
  }

  .search-sidebar__area--mobile-open {
    visibility: visible;
    pointer-events: auto;
    transition-delay: 0s;
  }

  .mobile-facets-backdrop {
    display: block;
    position: absolute;
    inset: 0;
    background: var(--cc-color-backdrop);
    opacity: 0;
    transition: opacity var(--facets-transition-duration) ease;
  }

  .search-sidebar__area--mobile-open .mobile-facets-backdrop {
    opacity: 1;
  }

  .mobile-facets-panel {
    position: absolute;
    inset-block: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    width: calc(100% - var(--cc-space-lg));
    background: var(--cc-color-surface);
    box-shadow: var(--cc-shadow-lg);
    transform: translateX(100%);
    transition: transform var(--facets-transition-duration) ease;
  }

  .search-sidebar__area--mobile-open .mobile-facets-panel {
    transform: translateX(0);
  }

  .mobile-facets-panel__header {
    display: block;
    flex: 0 0 auto;
    padding: var(--cc-space-md);
    margin: 0;
    border-bottom: 1px solid var(--cc-border-color-control);
  }

  .mobile-facets-back {
    min-height: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--cc-color-link);
    text-align: left;
  }

  .mobile-facets-back:focus-visible {
    outline: 2px solid var(--cc-color-primary);
    outline-offset: var(--cc-space-xs);
  }

  .mobile-facets-back span {
    margin: 0 var(--cc-space-xs) 0 0;
    font-size: var(--cc-font-size-xl);
    line-height: 1;
    transform: translateY(-0.1em);
  }

  .mobile-facets-panel__body {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
  }
}

@media (prefers-reduced-motion: reduce) {
  .search-sidebar__area,
  .mobile-facets-backdrop,
  .mobile-facets-panel {
    transition: none;
  }
}
</style>

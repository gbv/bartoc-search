<template>
  <nav
    aria-label="Search results summary"
    class="breadcrumb">
    <ol class="breadcrumb-list">
      <li class="breadcrumb-item">
        {{ formattedSummary }}
      </li>
    </ol>
  </nav>
</template>

<script>

export default {
  name: "NavBreadcrumb",
  props: {
    /**
     * Summary object for search result mode.
     * - from: number (start index)
     * - to: number (end index)
     * - total: number (total results)
     * - query: string (search term)
     */
    summary: {
      type: Object,
      required: true,
      validator(summary) {
        return (
          Number.isInteger(summary.from) &&
          Number.isInteger(summary.to) &&
          Number.isInteger(summary.total) &&
          typeof summary.query === "string"
        )
      },
    },
  },
  computed: {
    formattedSummary() {
      const { from, to, total, query } = this.summary
      const formatNumber = num => new Intl.NumberFormat().format(num)
      return `Showing ${formatNumber(from)} - ${formatNumber(to)} of ${formatNumber(total)} results for "${query}"`
    },
  },
}
</script>
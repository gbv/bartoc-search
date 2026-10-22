<template>
  <BartocFooter
    site-name="BARTOC.org"
    :internal-links="internalLinks"
    :external-links="externalLinks"
    :search-status-links="searchStatusLinks">
    <template #search-status>
      <span v-if="apiStatus.solr.connected">
        search in <b>{{ apiStatus.solr.indexedRecords }}</b> terminologies
        (<span v-if="formattedLastIndexedAt">as of <b>{{ formattedLastIndexedAt }}</b>, </span>live updates
        <b>{{ apiStatus.jskosServer.connected ? "enabled" : "disabled" }}</b>)
      </span>
      <span v-else>
        Search index not available!
      </span>
    </template>
  </BartocFooter>
</template>

<script setup>
import { computed, reactive, onMounted } from "vue"
import axios from "axios"
import { BartocFooter } from "@gbv/bartoc-components"
const baseUrl = import.meta.env.BASE_URL || "/"

const apiStatus = reactive({
  solr: {},
  jskosServer: {},
})

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Berlin",
})

const formattedLastIndexedAt = computed(() => {
  const value = apiStatus.solr.lastIndexedAt
  if (value == null || value === "") {
    return ""
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date)
})

const searchStatusLinks = [
  {
    href: `${baseUrl}api/status`,
    label: "Search API",
  },
  {
    href: "https://github.com/gbv/bartoc-search",
    label: "bartoc-search sources",
  },
]

const externalLinks = [
  { label: "Imprint", href: "https://www.gbv.de/impressum" },
  { label: "Privacy Policy", href: "https://www.gbv.de/datenschutz" },
  { label: "Mastodon", href: "https://code4lib.social/@bartoc", rel: "me" },
  { label: "BARTOC sources", href: "https://github.com/gbv/bartoc.org" },
  { label: "issues", href: "https://github.com/gbv/bartoc.org/issues" },
]

const internalLinks = [
  { href: "/api/", label: "API" },
  { href: "/download", label: "download" },
  { href: "/sparql", label: "SPARQL" },
]

onMounted(async () => {
  try {
    const res = await axios.get(`${baseUrl}api/status`)
    Object.assign(apiStatus, res.data)
  } catch (error) {
    console.warn(`Failed to fetch API status: ${error}`)
  }
})
</script>

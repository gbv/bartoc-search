<template>
  <footer class="footer">
    <div class="footer__container">
      <div class="footer__info">
        <span>&copy; {{ year }} Bartoc Search</span>
        <span class="footer__links">
          <a href="https://github.com/gbv/bartoc-search" target="_blank" rel="noopener">GitHub</a>
          <a href="/about">About</a>
        </span>
      </div>
      <div>
        <div> Solr Status : {{ Object.entries(solrStatus)
            .map(([key, value]) => `${key} = ${value}`)
            .join(' ---- ') }}
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import axios from 'axios'
import { SolrStatusResult } from '../../server/types/solr'

const year = new Date().getFullYear()

const solrStatus = reactive<SolrStatusResult>({
  connected: false,
  indexedRecords: 0,
  lastIndexedAt: '',
  lastUpdate: '',
  firstUpdate: '',
})

onMounted(async () => {
  try {
    const res = await axios.get(`${import.meta.env.BASE_URL}api/status`)
    Object.assign(solrStatus, res.data.solr)
  } catch (e) {
    console.warn('Could not fetch Solr status')
  }
})

</script>

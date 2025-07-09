<template>
  <footer>
    <div>
      <div v-if="apiStatus.solr.connected">
        search in <b>{{ apiStatus.solr.indexedRecords }}</b> terminologies,
        most recent update <b>{{ apiStatus.solr.lastIndexedAt }}</b>,
        live updates <b>{{ apiStatus.jskosServer.connected ? "enabled" : "disabled" }}</b>
      </div>
      <div v-else>
         Search index not available! 
      </div>
      <div class="footer__info">
        <span class="footer__links">
          <a href="https://github.com/gbv/bartoc-search" target="_blank" rel="noopener">GitHub</a>
        </span>
      </div>      
    </div>
  </footer>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import axios from 'axios'

const apiStatus = reactive({ solr: {}, jskosServer: {} })

onMounted(async () => {
  axios.get(`${import.meta.env.BASE_URL}api/status`)
    .then( res => { Object.assign(apiStatus, res.data) } )
    .catch(e => {
      console.warn('Failed to fetch API status')
    })
})
</script>

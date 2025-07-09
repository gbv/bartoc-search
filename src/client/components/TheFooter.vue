<template>
  <footer>
      <div v-if="apiStatus.solr.connected">
        search in <b>{{ apiStatus.solr.indexedRecords }}</b> terminologies,
        most recent update <b>{{ apiStatus.solr.lastIndexedAt }}</b>,
        live updates <b>{{ apiStatus.jskosServer.connected ? "enabled" : "disabled" }}</b>
      </div>
      <div v-else>
         Search index not available! 
      </div>
      <div>
        <a :href="`${baseUrl}api/status`" target="_blank">API</a>
        |
        <a href="https://github.com/gbv/bartoc-search" target="_blank">GitHub</a>        
      </div>      
  </footer>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import axios from 'axios'

const baseUrl = import.meta.env.BASE_URL
const apiStatus = reactive({ solr: {}, jskosServer: {} })

onMounted(async () => {
  axios.get(`${baseUrl}api/status`)
    .then( res => { Object.assign(apiStatus, res.data) } )
    .catch(e => {
      console.warn('Failed to fetch API status')
    })
})
</script>

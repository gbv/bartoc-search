<template>
  <BartocHeader
    :logo-url="logoUrl"
    logo-alt="BARTOC Search"
    :nav-links="navLinks"
    :utility-links="utilityLinks"
    :active-path="activePath"
    :user-can-add="userCanAdd"
    :edit-url="editUrl"
    :print-logo-url="printLogoUrl">
    <template #user-status>
      <UserStatus redirect />
    </template>
  </BartocHeader>
</template>

<script setup>
import { computed, inject, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { BartocHeader } from "@gbv/bartoc-components"
import logoUrl from "../assets/bartoc-logo.svg"
import printLogoUrl from "../assets/bartoc-logo_for_print.svg"

const { token } = inject("login-refs")
const userCanAdd = ref(false)
const authBase = "https://bartoc.org"
const editUrl = import.meta.env.DEV ? "https://dev.bartoc.org/edit" : "/edit"
const navLinks = [
  {
    href: "/about",
    label: "About",
  },
  {
    href: "/vocabularies",
    label: "Terminologies",
  },
  {
    href: "/registries",
    label: "Registries",
  },
  {
    href: "/software",
    label: "Software",
  },
  {
    href: "/stats",
    label: "Statistics",
  },
]
const utilityLinks = [
  {
    href: "/contact",
    label: "Contact & Editors",
  },
]

const route = useRoute()
const activePath = computed(() => route.name === "search" ? "/vocabularies" : "")

watch(token, async currentToken => {
  if (!currentToken) {
    userCanAdd.value = false
    return
  }

  try {
    const response = await fetch(
      `${authBase}/api/checkAuth?type=schemes&action=create`,
      {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      },
    )

    userCanAdd.value = response.ok
  } catch {
    userCanAdd.value = false
  }
}, { immediate: true })
</script>

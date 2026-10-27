export async function fetchSearchResults({ baseQuery, filters, limit, baseUrl }) {
  const params = new URLSearchParams()

  Object.entries(baseQuery || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value))
    }
  })

  params.set("start", "0")
  params.set("limit", String(limit))

  const filterList = Array.isArray(filters) ? filters : filters ? [filters] : []
  filterList.forEach((filter) => params.append("filter", filter))

  const res = await fetch(`${baseUrl || ""}api/search?${params}`)

  if (!res.ok) {
    throw new Error(`Status ${res.status}`)
  }

  const data = (await res.json()) || {}
  const response = data.response
  const docs = Array.isArray(response?.docs)
    ? response.docs.filter((doc) => doc && typeof doc === "object")
    : []

  return {
    docs,
    numFound: response?.numFound || 0,
    facets: data?.facets || {},
    editionsByMain: data?.editionsByMain,
    parentTitles: data?.parentTitles || {},
  }
}

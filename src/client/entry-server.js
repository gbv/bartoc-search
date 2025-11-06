import { renderToWebStream } from "vue/server-renderer"
import { createApp } from "./main"

export async function render(url) {
  // Create a fresh app instance for each request
  // This is important for SSR to ensure that the app state is not shared across requests
  // and to avoid issues with stateful components.
  const { app, router } = createApp(url, false)

  // Set the router's location to the requested URL
  // This will trigger the router to resolve the route and load the appropriate components.
  router.push(url)

  // Wait for the router to be ready
  // This is necessary to ensure that the route has been resolved and the components are ready to be rendered.
  // If the router is not ready, it may lead to rendering issues or errors
  await router.isReady()

  const ctx = {}
  const stream = renderToWebStream(app, ctx)

  if (!stream) {
    throw new Error("❌ renderToWebStream did not return a valid stream")
  }

  return { stream, ctx }
}

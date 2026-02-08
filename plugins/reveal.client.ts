export default defineNuxtPlugin(() => {
  const el = document.getElementById('__nuxt')
  if (el) {
    el.classList.add('ready')
  }
})

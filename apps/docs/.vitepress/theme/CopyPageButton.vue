<script setup lang="ts">
import { ref, onMounted, onUpdated, nextTick } from "vue";
import { useRoute } from "vitepress";

const route = useRoute();
const copied = ref(false);

function injectButton() {
  const existing = document.querySelector(".copy-page-injected");
  if (existing) existing.remove();

  const h1 = document.querySelector(".vp-doc h1");
  if (!h1) return;

  const wrapper = h1 as HTMLElement;
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "space-between";

  const btn = document.createElement("button");
  btn.className = "copy-page-injected";
  btn.title = "Copy page content";
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    const content = document.querySelector(".vp-doc");
    if (!content) return;
    await navigator.clipboard.writeText((content as HTMLElement).innerText);
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      btn.classList.remove("copied");
    }, 2000);
  });

  wrapper.appendChild(btn);
}

onMounted(() => {
  nextTick(injectButton);
});

onUpdated(() => {
  nextTick(injectButton);
});
</script>

<template>
  <ClientOnly>
    <span style="display: none" :key="route.path" />
  </ClientOnly>
</template>

<style>
.copy-page-injected {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-3);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 8px;
}

.copy-page-injected:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}

.copy-page-injected.copied {
  color: var(--vp-c-green-1);
}
</style>

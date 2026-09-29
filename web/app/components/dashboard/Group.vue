<template>
  <div class="glide-grain relative flex h-screen w-full overflow-hidden text-white">
    <div class="dashboard-glow dashboard-glow--a" aria-hidden="true" />
    <div class="dashboard-glow dashboard-glow--b" aria-hidden="true" />
    <div class="relative z-10 flex h-full w-full">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.dashboard-glow {
  position: fixed;
  z-index: 0;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(120px);
}
.dashboard-glow--a {
  top: -15%;
  right: -10%;
  width: 55vw;
  height: 45vh;
  background: rgba(3, 105, 161, 0.22);
}
.dashboard-glow--b {
  bottom: -20%;
  left: 10%;
  width: 40vw;
  height: 40vh;
  background: rgba(13, 148, 136, 0.14);
}
</style>

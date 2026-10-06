<template>
  <div class="flex flex-col gap-1.5">
    <USkeleton
      v-for="w in [90, 58]"
      :key="w"
      class="h-2.5 rounded-[5px] bg-[linear-gradient(90deg,var(--tile)_25%,var(--accent-soft)_50%,var(--tile)_75%)] bg-size-[200%_100%] animate-[lp-shimmer_1.3s_linear_infinite]"
      :style="{ width: `${w}%` }"
    />
  </div>
</template>

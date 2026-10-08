<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <section class="mx-auto mt-20 max-w-md text-center">
    <h1 class="text-3xl font-semibold">404</h1>
    <p class="mt-2 text-sm text-muted-foreground">Halaman yang kamu cari tidak ada.</p>
    <RouterLink :to="{ name: 'rooms' }" class="mt-6 inline-block">
      <Button>Kembali ke beranda</Button>
    </RouterLink>
  </section>
</template>

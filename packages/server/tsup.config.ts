import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  bundle: true,
  clean: true,
  // Bundle engine + shared into the server output so production has no TS source deps.
  noExternal: ['@belot/engine', '@belot/shared'],
  // Keep heavy native-ish deps external; npm install handles them on the host.
  external: [],
})

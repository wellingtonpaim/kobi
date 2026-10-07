import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'avatar',
    include: ['test/**/*.test.ts'],
  },
});

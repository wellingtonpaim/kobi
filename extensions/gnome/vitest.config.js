import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'gnome-extension',
    include: ['test/**/*.test.js'],
  },
});

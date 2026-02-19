const dsPreset = require('@the-boundary/design-system/tailwind-preset');
/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [dsPreset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    dsPreset.dsContentPath,
  ],
};

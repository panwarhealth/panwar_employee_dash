import type { Config } from 'tailwindcss';

/**
 * Employee dash uses the fixed Panwar Health brand palette only — there is
 * no per-client theming here (employees serve every client and shouldn't be
 * staring at Reckitt purple all morning then Bayer green all afternoon).
 *
 * Brand reference: panwarhealth.com.au tailwind.config.mjs uses #702f8f.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ph-purple': '#702f8f',
        'ph-pink': '#B41E8C',
        'ph-coral': '#FF8C50',
        'ph-sky': '#38C6F4',
        'ph-charcoal': '#454646',
        'ph-grey': '#454242',
      },
      fontFamily: {
        sans: ['"museo-sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

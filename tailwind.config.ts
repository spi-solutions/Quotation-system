import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#020617',
        foreground: '#0f172a',
        surface: '#020617',
        accent: {
          DEFAULT: '#4b205d',
          foreground: '#ffffff',
        },
      },
    },
  },
  plugins: [],
}

export default config


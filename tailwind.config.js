/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Delete default colours and only allow semantic ones
    colors: {
      surface: 'var(--surface)',
      'text-muted': 'var(--text-muted)',
      accent: 'var(--accent)',
      transparent: 'transparent',
      current: 'currentColor',
      // We might need a base text color or background color for body
      background: 'var(--background)',
      text: 'var(--text)',
    },
    // Delete default radius
    borderRadius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      full: 'var(--radius-full)',
      none: '0',
    },
    // Delete default durations
    transitionDuration: {
      fast: 'var(--dur-fast)',
      base: 'var(--dur-base)',
      slow: 'var(--dur-slow)',
      0: '0ms',
    },
    extend: {
      transitionTimingFunction: {
        DEFAULT: 'var(--ease)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        6: 'var(--space-6)',
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        glass: 'var(--shadow-glass)',
        lift: 'var(--shadow-lift)',
      },
      keyframes: {
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-slide-in': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'notification-slide-in': {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'select-slide-down': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'page-enter': 'page-enter 0.3s ease-out',
        'toast-slide-in': 'toast-slide-in 0.2s ease-out',
        'notification-slide-in': 'notification-slide-in 0.2s ease-out',
        'select-slide-down': 'select-slide-down 150ms ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

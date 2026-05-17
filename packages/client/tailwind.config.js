/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    '#0a0f0d',
        racing: '#0e251c',
        felt:   '#143b2e',
        feltHi: '#1c5240',
        brass:  '#c9a25a',
        brassHi:'#e6c178',
        cream:  '#f4eccb',
        paper:  '#ece2c2',
        ember:  '#7d1f2b',
        emberHi:'#a4303f',
        smoke:  '#e8e2d1',
        ash:    '#9aa39c',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.32em',
      },
      boxShadow: {
        card:      '0 18px 30px -18px rgba(0,0,0,.7), 0 2px 4px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.04)',
        cardHover: '0 32px 50px -22px rgba(0,0,0,.85), 0 4px 8px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.08)',
        plate:     'inset 0 1px 0 rgba(255,255,255,.06), 0 1px 0 rgba(0,0,0,.4), 0 20px 40px -28px rgba(0,0,0,.8)',
      },
      backgroundImage: {
        'felt-noise':
          'radial-gradient(ellipse at 50% 35%, rgba(28,82,64,.65) 0%, rgba(20,59,46,.95) 45%, rgba(10,22,17,1) 100%)',
        'paper-grain':
          'radial-gradient(ellipse at 20% 0%, rgba(0,0,0,.05), transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(0,0,0,.08), transparent 55%)',
      },
    },
  },
  plugins: [],
}

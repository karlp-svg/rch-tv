const fs = require('fs');

const vWoff2 = fs.readFileSync('public/fonts/Vortax.woff2').toString('base64');
const vOtf = fs.readFileSync('public/fonts/Vortax.otf').toString('base64');
const wWoff2 = fs.readFileSync('public/fonts/Westmeath.woff2').toString('base64');
const wOtf = fs.readFileSync('public/fonts/Westmeath.otf').toString('base64');

const css = `@import url('https://fonts.googleapis.com/css2?family=Audiowide&family=Caveat:wght@400;700&family=Gochi+Hand&family=Montserrat:wght@400;700;800;900&family=Orbitron:wght@800;900&family=Permanent+Marker&display=swap');

/* Vortax – inline embedded base64 for 100% reliable instant rendering across all mobile & TV devices */
@font-face {
  font-family: 'Vortax';
  src: url('data:font/woff2;charset=utf-8;base64,${vWoff2}') format('woff2'),
       url('data:font/opentype;base64,${vOtf}') format('opentype'),
       url('/fonts/Vortax.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}

/* Westmeath – inline embedded base64 for TV Wall of Fame header */
@font-face {
  font-family: 'Westmeath';
  src: url('data:font/woff2;charset=utf-8;base64,${wWoff2}') format('woff2'),
       url('data:font/opentype;base64,${wOtf}') format('opentype'),
       url('/fonts/Westmeath.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@import "tailwindcss";
`;

fs.writeFileSync('src/app/globals.css', css);
console.log('Successfully embedded Vortax and Westmeath inline base64 into globals.css');

const fs = require('fs');
let content = fs.readFileSync('app/layout.tsx', 'utf8');
content = content.replace(
  `<link rel='icon' type='image/png' href='/icon-192.png' />`,
  `<link rel='icon' type='image/png' href='/icon-192.png' />
        <script dangerouslySetInnerHTML={{__html:"(function(){try{var t=localStorage.getItem('protocol-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"}} />`
);
fs.writeFileSync('app/layout.tsx', content, 'utf8');
console.log('Done! Layout updated.');

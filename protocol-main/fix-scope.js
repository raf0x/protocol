const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `background:(activeCompoundTab||allCompounds[0]?.id)===item.id?rc+'22':cb`,
  `background:(activeCompoundTab||items[0]?.id)===item.id?rc+'22':cb`
);
content = content.replace(
  `boxShadow:(activeCompoundTab||allCompounds[0]?.id)===item.id?'0 0 12px '+rc:'none'`,
  `boxShadow:(activeCompoundTab||items[0]?.id)===item.id?'0 0 12px '+rc:'none'`
);
content = content.replace(
  `transform:(activeCompoundTab||allCompounds[0]?.id)===item.id?'scale(1.08)':'scale(1)'`,
  `transform:(activeCompoundTab||items[0]?.id)===item.id?'scale(1.08)':'scale(1)'`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');

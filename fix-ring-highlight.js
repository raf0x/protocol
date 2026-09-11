const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `background:(activeCompoundTab||items[0]?.id)===item.id?rc+'22':cb`,
  `background:(activeCompoundTab||items[0]?.id)===item.id?rc+'44':cb`
);
content = content.replace(
  `boxShadow:(activeCompoundTab||items[0]?.id)===item.id?'0 0 12px '+rc:'none'`,
  `boxShadow:(activeCompoundTab||items[0]?.id)===item.id?'0 0 18px '+rc+', 0 0 6px '+rc:'none'`
);
content = content.replace(
  `transform:(activeCompoundTab||items[0]?.id)===item.id?'scale(1.08)':'scale(1)'`,
  `transform:(activeCompoundTab||items[0]?.id)===item.id?'scale(1.15)':'scale(1)'`
);
content = content.replace(
  `border:'3px solid '+rc`,
  `border:((activeCompoundTab||items[0]?.id)===item.id?'4px':'3px')+' solid '+rc`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');

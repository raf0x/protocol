const fs = require('fs');
let content = fs.readFileSync('app/tracker/page.tsx', 'utf8');

// Fix HCG days
content = content.replace('{ dose: 2, date: "Apr 24", day: "Thu"', '{ dose: 2, date: "Apr 24", day: "Fri"');
content = content.replace('{ dose: 3, date: "Apr 28", day: "Mon"', '{ dose: 3, date: "Apr 28", day: "Tue"');
content = content.replace('{ dose: 4, date: "May 1", day: "Thu"', '{ dose: 4, date: "May 1", day: "Fri"');
content = content.replace('{ dose: 5, date: "May 5", day: "Mon"', '{ dose: 5, date: "May 5", day: "Tue"');
content = content.replace('{ dose: 6, date: "May 8", day: "Thu"', '{ dose: 6, date: "May 8", day: "Fri"');
content = content.replace('{ dose: 7, date: "May 12", day: "Mon"', '{ dose: 7, date: "May 12", day: "Tue"');
content = content.replace('{ dose: 8, date: "May 15", day: "Thu"', '{ dose: 8, date: "May 15", day: "Fri"');
content = content.replace('{ dose: 9, date: "May 19", day: "Mon"', '{ dose: 9, date: "May 19", day: "Tue"');

// Fix GHK days
content = content.replace('{ dose: 1, date: "Apr 22", day: "Tue"', '{ dose: 1, date: "Apr 22", day: "Wed"');
content = content.replace('{ dose: 2, date: "Apr 23", day: "Wed"', '{ dose: 2, date: "Apr 23", day: "Thu"');
content = content.replace('{ dose: 3, date: "Apr 24", day: "Thu"', '{ dose: 3, date: "Apr 24", day: "Fri"');
content = content.replace('{ dose: 4, date: "Apr 25", day: "Fri"', '{ dose: 4, date: "Apr 25", day: "Sat"');
content = content.replace('{ dose: 5, date: "Apr 26", day: "Sat"', '{ dose: 5, date: "Apr 26", day: "Sun"');
content = content.replace('{ dose: 6, date: "Apr 27", day: "Sun"', '{ dose: 6, date: "Apr 27", day: "Mon"');
content = content.replace('{ dose: 7, date: "Apr 28", day: "Mon"', '{ dose: 7, date: "Apr 28", day: "Tue"');
content = content.replace('{ dose: 8, date: "Apr 29", day: "Tue"', '{ dose: 8, date: "Apr 29", day: "Wed"');
content = content.replace('{ dose: 9, date: "Apr 30", day: "Wed"', '{ dose: 9, date: "Apr 30", day: "Thu"');

fs.writeFileSync('app/tracker/page.tsx', content, 'utf8');
console.log('Done');

const fs = require('fs');
const path = require('path');

const localesDir = 'C:/Users/Devin/peptid-tracker/src/i18n/locales';
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

// For steps that were renamed: old step N -> new step M
// The subtitle contains the old step number, we need to replace it with new
const subtitleFixes = [
  { key: 'ob_step_19_subtitle', oldN: '16', newN: '19' },
  { key: 'ob_step_20_subtitle', oldN: '17', newN: '20' },
  { key: 'ob_step_21_subtitle', oldN: '18', newN: '21' },
  { key: 'ob_step_22_subtitle', oldN: '19', newN: '22' },
  { key: 'ob_step_23_subtitle', oldN: '20', newN: '23' },
];

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const { key, oldN, newN } of subtitleFixes) {
    if (obj[key] && typeof obj[key] === 'string') {
      // Replace the number pattern - matches " 16 " or "16 ·" etc.
      obj[key] = obj[key].replace(
        new RegExp('(\\s|^)' + oldN + '(\\s|·|$)'),
        (m, pre, post) => pre + newN + post
      );
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}
console.log('Subtitle numbers fixed!');

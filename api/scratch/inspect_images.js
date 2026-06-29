import fs from 'fs';
import path from 'path';

const dir = 'c:/New/web-app/public';
const files = fs.readdirSync(dir).filter(f => f.startsWith('media__'));

for (const file of files) {
  const filePath = path.join(dir, file);
  const buffer = fs.readFileSync(filePath);
  const str = buffer.toString('utf8', 0, Math.min(buffer.length, 5000));
  
  console.log(`\nFile: ${file} (Size: ${buffer.length} bytes)`);
  
  const matches = [];
  ['openai', 'capcut', 'gemini', 'canva', 'adobe', 'photoshop', 'illustrator', 'google'].forEach(kw => {
    if (str.toLowerCase().includes(kw)) {
      matches.push(kw);
    }
  });
  
  if (matches.length > 0) {
    console.log(`-> Detected keywords: ${matches.join(', ')}`);
  } else {
    // Print first 200 printable characters of metadata to see if we can read anything
    const cleanStr = str.replace(/[^\x20-\x7E]/g, '.');
    console.log(`-> Head preview: ${cleanStr.slice(0, 300)}`);
  }
}

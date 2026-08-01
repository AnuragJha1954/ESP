const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend', 'src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  let p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  let original = content;

  // Replace fetch('/api/...
  content = content.replace(/fetch\(\s*['"]\/api\//g, "fetch(import.meta.env.VITE_API_URL + '/api/");
  
  // Replace fetch(`/api/...
  content = content.replace(/fetch\(\s*`\/api\//g, "fetch(`${import.meta.env.VITE_API_URL}/api/");

  if (content !== original) {
    fs.writeFileSync(p, content);
    console.log('Updated ' + file);
  }
});

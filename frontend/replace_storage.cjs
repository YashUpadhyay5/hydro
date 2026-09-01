const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');
let changed = 0;

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('sessionStorage')) {
        const newContent = content.replace(/sessionStorage/g, 'localStorage');
        fs.writeFileSync(file, newContent);
        console.log('Fixed', file);
        changed++;
    }
});

console.log(`Replaced in ${changed} files.`);

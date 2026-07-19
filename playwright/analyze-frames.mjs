import { readdirSync, statSync } from 'fs';
const files = readdirSync('screenshots')
  .filter(f => f.startsWith('frame-'))
  .map(f => ({ name: f, size: statSync('screenshots/' + f).size }));

const avg = files.reduce((s, f) => s + f.size, 0) / files.length;
const min = Math.min(...files.map(f => f.size));
const max = Math.max(...files.map(f => f.size));

console.log(`Frames: ${files.length}`);
console.log(`Avg: ${(avg/1024).toFixed(1)}KB, Min: ${(min/1024).toFixed(1)}KB, Max: ${(max/1024).toFixed(1)}KB`);

// Find anomalous frames (significantly smaller than average)
const threshold = avg * 0.5;
const anomalies = files.filter(f => f.size < threshold);
console.log(`\nAnomalous frames ( < ${(threshold/1024).toFixed(1)}KB ): ${anomalies.length}`);
anomalies.forEach(f => console.log(`  ${f.name}: ${(f.size/1024).toFixed(1)}KB`));

// Show size progression around anomalies
if (anomalies.length > 0) {
  const idx = files.indexOf(anomalies[0]);
  const start = Math.max(0, idx - 3);
  const end = Math.min(files.length, idx + 4);
  console.log(`\nAround first anomaly (frames ${start}-${end}):`);
  for (let i = start; i < end; i++) {
    const marker = i === idx ? ' <-- ANOMALY' : '';
    console.log(`  ${files[i].name}: ${(files[i].size/1024).toFixed(1)}KB${marker}`);
  }
}

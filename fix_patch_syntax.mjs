import fs from 'fs';

const filePath = 'components/teacher/TeacherResultsManager.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The previous patch might have left it as "BarChart data..." without "<" 
// Or it might have failed. Let's look for "BarChart data={" or "<RadarChart"

if (content.includes('BarChart data={') && !content.includes('<BarChart data={')) {
  content = content.replace('BarChart data={', '<BarChart data={');
}

// Ensure the closing tag is also correct if it was replaced as "BarChart>"
if (content.includes('/BarChart>') && !content.includes('</BarChart>')) {
  content = content.replace('/BarChart>', '</BarChart>');
}

fs.writeFileSync(filePath, content);
console.log('Fixed BarChart syntax');

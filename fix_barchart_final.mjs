import fs from 'fs';
const f = 'components/teacher/TeacherResultsManager.tsx';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(/(\n\s*)BarChart data={/g, '$1<BarChart data={');
fs.writeFileSync(f, c);
console.log('Fixed BarChart tag');

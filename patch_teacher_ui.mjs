import fs from 'fs';

const filePath = 'components/teacher/TeacherResultsManager.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace Title
content = content.replace(
  'Attendance vs Performance Helix',
  'Attendance vs Performance Analysis'
);

// Replace RadarChart block
const radarStart = content.indexOf('<RadarChart');
const radarEnd = content.indexOf('</RadarChart>') + '</RadarChart>'.length;

if (radarStart !== -1 && radarEnd !== -1) {
  const barChartCode = `BarChart data={[
                  { subject: 'Engagement', A: 85, B: 72 },
                  { subject: 'Consistency', A: 92, B: 88 },
                  { subject: 'Participation', A: 78, B: 65 },
                  { subject: 'Punctuality', A: 95, B: 90 },
                  { subject: 'Compliance', A: 88, B: 85 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="subject" stroke="#94a3b8" fontSize={9} fontWeight="900" axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                    contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '16px', backdropFilter: 'blur(16px)', padding: '12px' }}
                    itemStyle={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '10px' }}
                  />
                  <Bar dataKey="A" name="Active Cohort" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="B" name="Peer Median" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>`;
  
  content = content.substring(0, radarStart) + barChartCode + content.substring(radarEnd);
  fs.writeFileSync(filePath, content);
  console.log('Successfully replaced RadarChart with BarChart');
} else {
  console.error('Could not find RadarChart block');
}

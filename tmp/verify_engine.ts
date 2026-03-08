import { IntelligentEngine } from "../lib/ai/IntelligentEngine.ts";

async function runTests() {
  console.log("=== Intelligent Engine Verification ===\n");

  // Scenario 1: High attendance + on-time payments (Admin Finance Context)
  console.log("Scenario 1: High attendance + on-time payments (Finance View)");
  const res1 = await IntelligentEngine.process("finance-analytics", {
    statusCounts: { paid: 50, pending: 0, partial: 0, refunded: 0 }
  }, {});
  console.log(JSON.stringify(res1, null, 2));
  console.log("\n---\n");

  // Scenario 2: Low attendance + delayed payments (Teacher Context)
  console.log("Scenario 2: Low attendance + delayed payments (Teacher View)");
  const res2 = await IntelligentEngine.process("teacher-attendance", {
    avgAttendance: 65,
    atRiskCount: 8,
    dailyTrend: [{ date: "2024-01-01", rate: 70 }, { date: "2024-01-02", rate: 65 }],
    atRiskStudents: [{ name: "John Smith" }]
  }, { className: "Math 101" });
  console.log(JSON.stringify(res2, null, 2));
  console.log("\n---\n");

  // Scenario 3: Average attendance + partial payments (Student Context)
  console.log("Scenario 3: Average attendance + partial payments (Student View)");
  const res3 = await IntelligentEngine.process("student-attendance", {
    summaries: [{ percentage: 82, eligible: false }]
  }, { name: "Alex Johnson" });
  console.log(JSON.stringify(res3, null, 2));
}

runTests().catch(console.error);

const skills = discoverSkills(".agents/skills/*-best-practice/");

const results = await Promise.all(
  skills.map((skill) => runBestPracticeCheck(skill)),
);

const report = {
  total: results.length,
  passed: results.filter((r) => r.status === "passed").length,
  failed: results.filter((r) => r.status === "failed").length,
  violations: results.flatMap((r) => r.violations),
};

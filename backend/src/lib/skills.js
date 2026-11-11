// Skill dictionary used for both CV parsing and job tagging.
// key = canonical name, value = aliases (lowercase). Extend freely.
export const SKILLS = {
  // Software
  javascript: ['javascript', 'js', 'es6'], typescript: ['typescript', 'ts'],
  react: ['react', 'reactjs', 'react.js'], 'next.js': ['next.js', 'nextjs'], vue: ['vue', 'vuejs', 'vue.js'],
  angular: ['angular'], 'node.js': ['node.js', 'nodejs', 'node'], express: ['express', 'expressjs'],
  python: ['python'], django: ['django'], flask: ['flask'], fastapi: ['fastapi'],
  java: ['java'], spring: ['spring boot', 'spring'], 'c#': ['c#', 'csharp'], '.net': ['.net', 'asp.net', 'dotnet'],
  php: ['php'], laravel: ['laravel'], wordpress: ['wordpress'], go: ['golang'], rust: ['rust'],
  kotlin: ['kotlin'], swift: ['swift'], flutter: ['flutter'], 'react native': ['react native'], android: ['android'], ios: ['ios'],
  sql: ['sql'], postgresql: ['postgresql', 'postgres'], mysql: ['mysql'], mongodb: ['mongodb', 'mongo'], redis: ['redis'],
  aws: ['aws', 'amazon web services'], azure: ['azure'], gcp: ['gcp', 'google cloud'],
  docker: ['docker'], kubernetes: ['kubernetes', 'k8s'], devops: ['devops', 'ci/cd'], linux: ['linux'],
  'machine learning': ['machine learning', 'ml'], 'deep learning': ['deep learning'], ai: ['artificial intelligence', 'ai', 'llm', 'genai', 'generative ai'],
  'data science': ['data science', 'data scientist'], 'data analysis': ['data analysis', 'data analyst', 'analytics'],
  pandas: ['pandas'], tensorflow: ['tensorflow'], pytorch: ['pytorch'], nlp: ['nlp', 'natural language processing'],
  'power bi': ['power bi', 'powerbi'], tableau: ['tableau'], excel: ['excel', 'ms excel'],
  html: ['html', 'html5'], css: ['css', 'css3', 'tailwind', 'sass'], graphql: ['graphql'], 'rest api': ['rest api', 'restful', 'api development'],
  'ui/ux': ['ui/ux', 'ux', 'ui design', 'figma'], 'graphic design': ['graphic design', 'photoshop', 'illustrator'],
  qa: ['qa', 'quality assurance', 'testing', 'selenium', 'cypress'], cybersecurity: ['cybersecurity', 'security', 'penetration testing'],
  gis: ['gis', 'arcgis', 'qgis', 'remote sensing'],
  // Business / admin / govt-relevant
  'project management': ['project management', 'pmp', 'project manager'], 'disaster management': ['disaster management', 'disaster risk', 'drr', 'emergency management'],
  accounting: ['accounting', 'acca', 'ca ', 'icma', 'bookkeeping'], finance: ['finance', 'financial analysis'], audit: ['audit', 'auditor'],
  hr: ['human resource', 'hr ', 'recruitment', 'talent acquisition'], marketing: ['marketing'], 'digital marketing': ['digital marketing', 'seo', 'sem', 'social media marketing'],
  sales: ['sales', 'business development'], 'content writing': ['content writing', 'copywriting', 'content writer'],
  'customer support': ['customer support', 'customer service', 'call center'], teaching: ['teaching', 'lecturer', 'teacher', 'instructor'],
  'civil engineering': ['civil engineering', 'civil engineer', 'autocad'], 'electrical engineering': ['electrical engineering', 'electrical engineer'],
  'mechanical engineering': ['mechanical engineering', 'mechanical engineer'], nursing: ['nursing', 'nurse'], medical: ['mbbs', 'medical officer', 'doctor'],
  law: ['llb', 'legal', 'lawyer', 'advocate'], 'monitoring & evaluation': ['monitoring and evaluation', 'm&e', 'monitoring & evaluation'],
  procurement: ['procurement', 'supply chain'], 'video editing': ['video editing', 'premiere pro', 'after effects', 'capcut'],
  'ms office': ['ms office', 'microsoft office', 'word', 'powerpoint'], urdu: ['urdu'], english: ['english'],
};

const ENTRIES = Object.entries(SKILLS).flatMap(([canon, aliases]) =>
  aliases.map((a) => [canon, new RegExp(`(^|[^a-z0-9+#.])${a.trim().replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?=$|[^a-z0-9+#])`, 'i')])
);

/** Return canonical skill names mentioned in text. */
export function findSkills(text) {
  if (!text) return [];
  const t = ` ${String(text).toLowerCase()} `;
  const found = new Set();
  for (const [canon, re] of ENTRIES) if (re.test(t)) found.add(canon);
  // 'ai' and 'go' are very short; require stronger evidence
  if (found.has('ai') && !/\b(artificial intelligence|llm|genai|generative ai|machine learning|\bai\b engineer)/i.test(t) && (t.match(/\bai\b/g) || []).length < 2) found.delete('ai');
  return [...found];
}

/** Rough years-of-experience extraction from a CV or job description. */
export function findExperienceYears(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:experience|exp)/i);
  return m ? Math.min(40, +m[1]) : null;
}

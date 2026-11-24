import * as fs from 'fs';
import * as path from 'path';

export type LensRoofSkillName =
  | 'legal-contract-redlining'
  | 'real-estate-due-diligence'
  | 'financial-underwriting'
  | 'govt-scheme-decoder';

const skillCache = new Map<LensRoofSkillName, string>();

/**
 * Loads version-controlled, open-source-patterned SKILL.md playbooks from /skills/<name>/SKILL.md
 * to power every AI Advisor, Agreement Redliner, Underwriting, and Govt Scheme prompt in LensRoof.
 */
export function loadLensRoofSkillPrompt(skillName: LensRoofSkillName): string {
  const cached = skillCache.get(skillName);
  if (cached) return cached;

  const candidates = [
    path.resolve(process.cwd(), 'skills', skillName, 'SKILL.md'),
    path.resolve(__dirname, '../../../../skills', skillName, 'SKILL.md'),
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        // Strip YAML frontmatter for clean system_instruction injection
        const body = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
        skillCache.set(skillName, body);
        return body;
      }
    } catch {
      // try next path
    }
  }

  return `You are LensRoof's specialized ${skillName} analyst. Be rigorous, grounded, and strictly buyer-first.`;
}

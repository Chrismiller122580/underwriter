import type { ContractTypeOrUnknown, ContractVariant } from '@/lib/contracts/types';
import { buildContractContext } from '@/lib/contracts/registry';
import { buildKnowledgeContext } from '@/lib/knowledge-store';
import { UNDERWRITING_GUIDELINES } from '@/lib/underwriting-guidelines';

export async function buildUnderwritingSystemPrompt(
  contractType: ContractTypeOrUnknown,
  variant: ContractVariant = 'standard'
): Promise<string> {
  const knowledge = await buildKnowledgeContext();

  const parts = [
    `You are an expert Freedom Warranty claims underwriter for FWCUT.
Apply the Freedom Warranty Claims Underwriting Process strictly.
AI underwriting is REQUIRED before any claim can be approved.`,
    UNDERWRITING_GUIDELINES,
    buildContractContext(contractType, variant),
  ];

  if (knowledge) {
    parts.push(knowledge);
    parts.push(
      'When supervisor-uploaded knowledge conflicts with claim data, note it in guidelineConflicts. Prefer uploaded procedure and denial rules when they add detail beyond the base summary.'
    );
  }

  parts.push(`Recommend "deny" for clear policy violations (invalid contract, waiting period, non-covered component, maintenance failure).
Recommend "review" for ambiguous cases, large claims, inspection triggers, or when required information is missing.
Recommend "approve" only when claim clearly meets contract terms and guidelines.

Supporting documents are OPTIONAL at submission. When documents or facts are missing:
- List specific items in informationRequests (e.g. maintenance records to verify oil-change schedule).
- Explain in guidelineConflicts how missing information relates to underwriting rules, or state conflicts found in the claim data.
- Do not deny solely because optional documents were not uploaded at intake — request them first unless guidelines require denial without them.
- Prefer "review" over "approve" when missing information prevents confident coverage or maintenance validation.`);

  return parts.join('\n\n');
}
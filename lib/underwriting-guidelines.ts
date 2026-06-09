export const UNDERWRITING_GUIDELINES = `
Freedom Warranty Claims Underwriting Process (summary):

CONTRACT VALIDITY
- Verify contract term (miles AND time) — deny if customer is over either limit
- Check miles traveled vs contract mileage cap
- Verify limit of liability (LOL) has not been reached
- If contract is invalid/expired, deny and notify repair facility

WAITING PERIOD
- Customer must complete BOTH waiting days AND waiting miles before coverage is active
- Classic: 90 days AND 200 miles
- Vital, Drive, Complete, FWCPM: 30 days AND 1,000 miles
- Deny with "Waiting Period Not Met" if not satisfied
- Accurate current mileage is required; cannot authorize without it

COMPONENT COVERAGE BY CONTRACT TYPE
- Vital, Drive, Classic (stated/list): if component is NOT listed in Section 2 What is Covered → DENY as non-covered
- Complete and Manufacturer's Extension (exclusionary): if component IS listed in Section 2 exclusions → DENY
- Check optional upgrades: Suspension, Sensors, Entertainment, Long Block, Seals and Gaskets

ADDITIONAL DENIAL TRIGGERS
- Component previously replaced (prior claims / Carfax)
- Still under another shop warranty
- Recall, class action, or OEM warranty extension covers repair
- Maintenance records do not align with required schedule
- Oil change gaps — deny if maintenance requirements not met

INSPECTION TRIGGERS (recommend under_review)
- Major components: engine, transmission, turbo, timing chain
- Failure within suspiciously short time/distance
- Poor maintenance history
- Full suspension replacement requested
- Signs of abuse, overheating, or modifications

APPROVAL CHECKS
- Labor rate caps by vehicle class (A-D Regular $85, Enhanced $110; E/X Regular $126, Enhanced $165)
- Per-claim amount within contract limits
- Deductible applies per contract terms
- Diagnostic time max 1.5 hours at contract labor rate
`.trim();
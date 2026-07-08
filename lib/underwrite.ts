export type UnderwritingResult = {
  decision: 'approved' | 'denied' | 'pending';
  reason: string;
};
import { ClaimForm } from '@/components/ClaimForm';

export default function SubmitPage() {
  return (
    <main className="container page-main">
      <div className="card">
        <p className="badge">Submit Claim</p>
        <h1 className="page-title">Claim Information Form</h1>
        <p className="page-intro">
          Staff-only claim intake. Enter the policy number to identify the contract
          type, use screenshot autofill for remaining fields, and submit on behalf
          of the claimant. Supporting documents are optional — AI underwriting
          will request anything else needed.
        </p>
        <ClaimForm />
      </div>
    </main>
  );
}
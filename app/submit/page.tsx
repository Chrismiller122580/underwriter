import { ClaimForm } from '@/components/ClaimForm';

export default function SubmitPage() {
  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card">
        <p className="badge">Submit Claim</p>
        <h1 style={{ marginTop: 12 }}>Claim Information Form</h1>
        <p className="page-intro">
          Enter your policy number to identify the contract type, use screenshot
          autofill for remaining fields, and submit. Supporting documents are
          optional — AI underwriting will request anything else needed.
        </p>
        <ClaimForm />
      </div>
    </main>
  );
}
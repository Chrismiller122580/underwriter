import { ClaimForm } from '@/components/ClaimForm';

export default function SubmitPage() {
  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card">
        <p className="badge">Submit Claim</p>
        <h1 style={{ marginTop: 12 }}>Claim Information Form</h1>
        <p className="page-intro">
          Upload a screenshot from your portal to autofill most fields with AI, then
          review, attach supporting documents, and submit.
        </p>
        <ClaimForm />
      </div>
    </main>
  );
}
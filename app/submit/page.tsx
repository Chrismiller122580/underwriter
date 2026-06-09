import { ClaimForm } from '@/components/ClaimForm';

export default function SubmitPage() {
  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card">
        <p className="badge">Submit Claim</p>
        <h1 style={{ marginTop: 12 }}>Claim Information Form</h1>
        <p className="page-intro">
          Complete all sections below. Required documents can be uploaded directly —
          max 10 MB per file.
        </p>
        <ClaimForm />
      </div>
    </main>
  );
}
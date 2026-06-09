import { LoginForm } from '@/components/LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <p className="badge">Adjuster Access</p>
        <h1 style={{ marginTop: 12 }}>Sign In</h1>
        <p className="page-intro">
          Underwriters and supervisors must sign in to view the claims dashboard
          and run underwriting decisions.
        </p>
        <LoginForm redirectTo={searchParams.next ?? '/claims'} />
      </div>
    </main>
  );
}
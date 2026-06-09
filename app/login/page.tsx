import { LoginForm } from '@/components/LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; role?: string };
}) {
  const defaultRole =
    searchParams.role === 'supervisor' ? 'supervisor' : 'adjuster';

  return (
    <main className="container" style={{ marginTop: 32 }}>
      <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <p className="badge">Staff Access</p>
        <h1 style={{ marginTop: 12 }}>Sign In</h1>
        <p className="page-intro">
          Choose adjuster or supervisor, then enter the matching password.
          Supervisors can upload AI underwriting knowledge.
        </p>
        <LoginForm
          redirectTo={searchParams.next ?? '/claims'}
          defaultRole={defaultRole}
        />
      </div>
    </main>
  );
}
import { LoginForm } from '@/components/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; role?: string };
}) {
  const defaultRole =
    searchParams.role === 'supervisor' ? 'supervisor' : 'adjuster';

  return (
    <main className="container page-main">
      <div className="page-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="card login-card">
        <p className="badge">Staff Access</p>
        <h1 className="page-title">Sign In</h1>
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
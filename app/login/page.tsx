import { LoginForm } from '@/components/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; role?: string }>;
}) {
  const params = await searchParams;
  const defaultRole =
    params.role === 'supervisor' ? 'supervisor' : 'adjuster';

  return (
    <main className="container page-main">
      <div className="page-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="card login-card">
        <p className="badge">Staff Access</p>
        <h1 className="page-title">Sign In</h1>
        <p className="page-intro">
          Sign in with your staff email and password. Supervisors can manage
          users, AI knowledge, and the full toolbox.
        </p>
        <LoginForm
          redirectTo={params.next ?? '/claims'}
          defaultRole={defaultRole}
        />
      </div>
    </main>
  );
}
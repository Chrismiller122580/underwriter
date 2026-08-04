import { LoginForm } from '@/components/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="container page-main">
      <div className="page-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="card login-card">
        <p className="badge">Staff Access</p>
        <h1 className="page-title">Sign In</h1>
        <p className="page-intro">
          Sign in with your staff email and password. <strong>Reviewers</strong>{' '}
          (same as adjuster) underwrite claims. <strong>Supervisors</strong> can
          open Admin Tools to manage users, AI knowledge, sandbox, and bulk
          operations.
        </p>
        <LoginForm redirectTo={params.next ?? '/claims'} />
      </div>
    </main>
  );
}

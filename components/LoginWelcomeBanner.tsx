'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  consumeLoginBanner,
  type LoginBannerPayload,
} from '@/lib/login-banner';
import { formatRoleLabel } from '@/lib/roles';

export function LoginWelcomeBanner() {
  const [banner, setBanner] = useState<LoginBannerPayload | null>(null);

  useEffect(() => {
    setBanner(consumeLoginBanner());
  }, []);

  if (!banner) return null;

  const isSupervisor = banner.role === 'supervisor';
  const label = formatRoleLabel(banner.role);
  const who = banner.name || banner.email || label;

  return (
    <div
      className={`login-welcome-banner${
        isSupervisor ? ' login-welcome-supervisor' : ''
      }`}
      role="status"
    >
      <div className="login-welcome-copy">
        <strong>Signed in as {who}</strong>
        <span className="login-welcome-role">{label}</span>
        <p>
          {isSupervisor ? (
            <>
              Supervisors underwrite claims and manage{' '}
              <Link href="/admin/toolbox">Admin Tools</Link> (knowledge, users,
              bulk AI, sandbox). Open a claim from the queue for a full
              workspace.
            </>
          ) : (
            <>
              Reviewers work the claim queue: open a claim, run AI scan, request
              info if needed, then underwrite. You do not have Admin Tools
              access.
            </>
          )}
        </p>
      </div>
      <div className="login-welcome-actions">
        {isSupervisor ? (
          <Link href="/admin/toolbox" className="button button-sm">
            Open Admin Tools
          </Link>
        ) : null}
        <button
          type="button"
          className="link-button"
          onClick={() => setBanner(null)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

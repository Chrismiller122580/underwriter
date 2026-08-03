import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  UnauthorizedError,
  apiFetch,
  isUnauthorized,
  loginPath,
} from '@/lib/client-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loginPath', () => {
  it('encodes the next path', () => {
    expect(loginPath('/claims')).toBe('/login?next=%2Fclaims');
    expect(loginPath('/admin/toolbox')).toBe('/login?next=%2Fadmin%2Ftoolbox');
  });
});

describe('apiFetch', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(apiFetch<{ ok: boolean }>('/api/health')).resolves.toEqual({
      ok: true,
    });
  });

  it('throws UnauthorizedError on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    );

    await expect(apiFetch('/api/claims')).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  it('throws ApiError with server message on other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Claim not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    try {
      await apiFetch('/api/claims/x');
      expect.fail('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).message).toBe('Claim not found');
    }
  });
});

describe('isUnauthorized', () => {
  it('detects UnauthorizedError only', () => {
    expect(isUnauthorized(new UnauthorizedError())).toBe(true);
    expect(isUnauthorized(new ApiError('nope', 500))).toBe(false);
    expect(isUnauthorized(new Error('other'))).toBe(false);
  });
});

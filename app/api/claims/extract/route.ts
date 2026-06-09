import { NextResponse } from 'next/server';
import {
  EXTRACTABLE_FIELDS,
  extractClaimFromScreenshot,
} from '@/lib/extract-claim';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`extract:${ip}`, 20, 60 * 60 * 1000);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many extraction requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const screenshot = formData.get('screenshot');

    if (!(screenshot instanceof File) || screenshot.size === 0) {
      return NextResponse.json(
        { error: 'A screenshot image is required.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(screenshot.type)) {
      return NextResponse.json(
        { error: 'Screenshot must be PNG, JPEG, or WebP.' },
        { status: 400 }
      );
    }

    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json(
        { error: 'Screenshot must be 5 MB or smaller.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await screenshot.arrayBuffer());
    const result = await extractClaimFromScreenshot(buffer, screenshot.type);

    const missingFields = EXTRACTABLE_FIELDS.filter(
      (field) => !result.fields[field]
    );

    return NextResponse.json({
      fields: result.fields,
      fieldsFound: result.fieldsFound,
      filledCount: result.fieldsFound.length,
      missingFields,
      notes: result.notes,
    });
  } catch (error) {
    logger.error('Screenshot extraction failed', {
      ip,
      error: error instanceof Error ? error.message : 'unknown',
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to extract data from screenshot',
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import {
  EXTRACTABLE_FIELDS,
  extractClaimFromScreenshots,
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
const MAX_SCREENSHOTS = 10;

function collectScreenshots(formData: FormData): File[] {
  const fromPlural = formData
    .getAll('screenshots')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (fromPlural.length > 0) return fromPlural;

  const single = formData.get('screenshot');
  if (single instanceof File && single.size > 0) return [single];

  return [];
}

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
    const screenshots = collectScreenshots(formData);

    if (screenshots.length === 0) {
      return NextResponse.json(
        { error: 'At least one screenshot image is required.' },
        { status: 400 }
      );
    }

    if (screenshots.length > MAX_SCREENSHOTS) {
      return NextResponse.json(
        { error: `You can upload up to ${MAX_SCREENSHOTS} screenshots at a time.` },
        { status: 400 }
      );
    }

    const images: Array<{ buffer: Buffer; mimeType: string }> = [];

    for (const screenshot of screenshots) {
      if (!ALLOWED_TYPES.has(screenshot.type)) {
        return NextResponse.json(
          { error: 'All screenshots must be PNG, JPEG, or WebP.' },
          { status: 400 }
        );
      }

      if (screenshot.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json(
          { error: 'Each screenshot must be 5 MB or smaller.' },
          { status: 400 }
        );
      }

      images.push({
        buffer: Buffer.from(await screenshot.arrayBuffer()),
        mimeType: screenshot.type,
      });
    }

    const result = await extractClaimFromScreenshots(images);

    const missingFields = EXTRACTABLE_FIELDS.filter(
      (field) => !result.fields[field]
    );

    return NextResponse.json({
      fields: result.fields,
      fieldsFound: result.fieldsFound,
      filledCount: result.fieldsFound.length,
      missingFields,
      screenshotCount: images.length,
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
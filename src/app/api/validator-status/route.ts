import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const MOCK_VALIDATOR_STATUS: Record<string, { status: 'Healthy' | 'Delayed' | 'Offline'; updatedAt: string }> = {
  'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A': { status: 'Healthy', updatedAt: new Date().toISOString() },
  'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA': { status: 'Healthy', updatedAt: new Date().toISOString() },
  'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122': { status: 'Healthy', updatedAt: new Date().toISOString() },
  'GCXXVHZLKMNPQRSXYZABCDEFGHIJKLM7766': { status: 'Offline', updatedAt: new Date().toISOString() },
};

export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => ({}));
  const addresses = Array.isArray(rawBody.addresses)
    ? Array.from(new Set(rawBody.addresses.filter((item: unknown): item is string => typeof item === 'string')))
    : [];

  const data = addresses.map((address) => ({
    address,
    status: MOCK_VALIDATOR_STATUS[address]?.status ?? 'Delayed',
    updatedAt: MOCK_VALIDATOR_STATUS[address]?.updatedAt ?? new Date().toISOString(),
  }));

  return NextResponse.json({ data });
}

export async function GET() {
  return NextResponse.json({
    data: Object.entries(MOCK_VALIDATOR_STATUS).map(([address, info]) => ({
      address,
      status: info.status,
      updatedAt: info.updatedAt,
    })),
  });
}

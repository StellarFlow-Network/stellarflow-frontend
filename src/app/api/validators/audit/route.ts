import { NextResponse } from 'next/server';
import type { ValidatorNode } from '@/types/validators';

const VALIDATORS: ValidatorNode[] = [
  {
    id: 'val-01',
    name: 'Kaduna Nexus Core',
    address: 'GAA...42K',
    uptime: 99.94,
    missedBlocks: 2,
    slashingEvents: 0,
    stakedXlm: 50000,
    status: 'active',
  },
  {
    id: 'val-02',
    name: 'Mombasa Relay Edge',
    address: 'GBC...97X',
    uptime: 94.21,
    missedBlocks: 14,
    slashingEvents: 1,
    stakedXlm: 45000,
    status: 'active',
  },
  {
    id: 'val-03',
    name: 'Accra Liquidity Node',
    address: 'GDH...11W',
    uptime: 78.45,
    missedBlocks: 89,
    slashingEvents: 3,
    stakedXlm: 12000,
    status: 'jailed',
  },
  {
    id: 'val-04',
    name: 'Lagos Ingestion Hub',
    address: 'GDK...88P',
    uptime: 0.0,
    missedBlocks: 450,
    slashingEvents: 5,
    stakedXlm: 0,
    status: 'offline',
  },
];

export async function GET() {
  return NextResponse.json(VALIDATORS, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

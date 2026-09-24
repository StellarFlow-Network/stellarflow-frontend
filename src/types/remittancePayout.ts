/**
 * A single remittance payout as shown in the receiver's history — enough
 * detail to reproduce a printable receipt or a line in a CSV accounting
 * statement: transaction reference, exchange rate applied, and which
 * licensed anchor processed the off-ramp.
 */
export interface RemittancePayoutRecord {
  id: string;
  /** ISO-8601 timestamp the payout settled */
  date: string;
  transactionHash: string;
  anchorName: string;
  anchorReference: string;
  senderName: string;
  recipientName: string;
  recipientAddress?: string;
  amountSent: number;
  sentCurrency: string;
  amountReceived: number;
  receivedCurrency: string;
  /** e.g. "1 USD = 1487.50 NGN" */
  exchangeRate: string;
  fee: number;
  feeCurrency: string;
  status: "completed" | "pending" | "failed";
}

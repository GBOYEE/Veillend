import { Injectable, Logger } from '@nestjs/common';
import { HorizonService } from '../stellar/horizon.service';
import { ServiceResponse } from '../stellar/types';
import { TransactionRecord } from './transactions.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly horizonService: HorizonService) {}

  async getTransactions(walletAddress: string): Promise<ServiceResponse<TransactionRecord[]>> {
    try {
      const client = this.horizonService.getClient();
      const txs = await client.transactions().forAccount(walletAddress).limit(20).order('desc').call();

      const records: TransactionRecord[] = txs.records.map((tx) => {
        // Determine transaction type from operations
        let type: TransactionRecord['type'] = 'transfer';
        let amount = 0;
        let asset = 'XLM';

        if (tx.operations && tx.operations.length > 0) {
          const op = tx.operations[0];
          if (op.type === 'payment') {
            type = 'transfer';
            amount = parseFloat(op.amount as string) || 0;
            asset = (op.asset_code as string) || 'XLM';
          } else if (op.type === 'change_trust') {
            type = 'deposit';
            amount = parseFloat(op.limit as string) || 0;
            asset = (op.asset_code as string) || 'UNKNOWN';
          }
        }

        return {
          id: tx.id,
          type,
          amount,
          asset,
          timestamp: tx.created_at,
          status: tx.successful ? 'success' : 'failed',
          txHash: tx.hash,
        };
      });

      return {
        success: true,
        data: records,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
      this.logger.warn(`Transaction fetch failed for ${walletAddress}: ${message}`);
      return {
        success: false,
        error: { message, code: 'TRANSACTIONS_FETCH_ERROR', rawError: error },
      };
    }
  }
}

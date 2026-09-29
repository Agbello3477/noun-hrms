import basePrisma from '../prisma';

/**
 * Enhanced Prisma client proxy supporting model aliases such as:
 * - prisma.staffPosting -> prisma.transferLog
 * and forwarding into transactional instances (tx.staffPosting -> tx.transferLog).
 */
function createPrismaProxy(targetClient: any): any {
  return new Proxy(targetClient, {
    get(target, prop, receiver) {
      if (prop === 'staffPosting') {
        return (target as any).staffPosting || (target as any).transferLog;
      }
      if (prop === 'transferLog') {
        return (target as any).transferLog || (target as any).staffPosting;
      }
      if (prop === '$transaction') {
        const origTransaction = target.$transaction ? target.$transaction.bind(target) : null;
        if (!origTransaction) return undefined;
        return async (...args: any[]) => {
          if (typeof args[0] === 'function') {
            const userCallback = args[0];
            return origTransaction(async (tx: any) => {
              const proxiedTx = createPrismaProxy(tx);
              return userCallback(proxiedTx);
            }, args[1]);
          }
          return origTransaction(...args);
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

export const prisma = createPrismaProxy(basePrisma);
export default prisma;

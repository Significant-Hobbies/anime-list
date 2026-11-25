import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { refreshFranchiseIndex } from '../assistant/franchiseCatalog';

// Uses the same explicitly selected D1 target as the other catalog sync scripts.
// Retained attempts and source timestamps make successive runs resumable.
async function main() {
  configureOperatorDatabaseFromArgs();
  const arg = process.argv.find((value) => value.startsWith('--batches='));
  const batches = Number(arg?.slice('--batches='.length) ?? 1);
  if (!Number.isSafeInteger(batches) || batches < 1 || batches > 1000) {
    throw new Error('Expected --batches between 1 and 1000.');
  }
  for (let i = 0; i < batches; i++) {
    const result = await refreshFranchiseIndex(24, true);
    console.log(JSON.stringify({ batch: i + 1, ...result }));
    if (!result.selected || result.refreshed < result.selected) break;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

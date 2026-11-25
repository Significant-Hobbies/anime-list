import { getDb } from '../db/client';
import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { createMetadataReader } from './catalogMetadataProvider';
import { bootstrapTrackedFranchises } from './trackedFranchiseBootstrap';

async function main() {
  configureOperatorDatabaseFromArgs();
  const limit = Number(
    process.argv.find((arg) => arg.startsWith('--max-titles='))?.slice('--max-titles='.length) ??
      10000
  );
  const result = await bootstrapTrackedFranchises(getDb(), createMetadataReader(), limit);
  if (result.interrupted)
    throw new Error(
      'Provider errors interrupted the bootstrap. Completed work and retry windows were saved.'
    );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

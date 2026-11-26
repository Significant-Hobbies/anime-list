import { getDb } from '../db/client';
import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { createMetadataReader, type Media } from './catalogMetadataProvider';
import { backfillCatalogMetadata } from './catalogMetadataBackfill';

async function main() {
  configureOperatorDatabaseFromArgs();
  const selected =
    process.argv.find((arg) => arg.startsWith('--media='))?.slice('--media='.length) ?? 'both';
  if (!['both', 'anime', 'manga'].includes(selected))
    throw new Error('Expected --media=both, anime, or manga.');
  const media: Media[] = selected === 'both' ? ['anime', 'manga'] : [selected as Media];
  const reader = createMetadataReader();
  for (const kind of media) await backfillCatalogMetadata(getDb(), reader, kind);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

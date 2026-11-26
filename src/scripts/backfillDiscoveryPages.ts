import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { prepareDiscoveryPages } from './prepareDiscoveryPages';
configureOperatorDatabaseFromArgs();
for (const media of ['anime', 'manga'] as const) {
  const result = await prepareDiscoveryPages(media);
  console.log(media, 'discovery backfill', result);
  if (result.remaining) process.exitCode = 1;
}

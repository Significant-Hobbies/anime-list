import { configureOperatorDatabaseFromArgs } from '../db/operatorClient';
import { prepareDiscoveryPages } from './prepareDiscoveryPages';
configureOperatorDatabaseFromArgs();
for (const media of ['anime', 'manga'] as const) {
  console.log(media, 'discovery buckets processed:', await prepareDiscoveryPages(media));
}

import { proxyApiRequest } from '../_apiProxy';

export const onRequest: PagesFunction = async ({ request }) => proxyApiRequest(request);

import { detailPage } from '../_detail-page';
import { getAnimeEntry } from '../_seo-dataset';

export const onRequestGet: PagesFunction = (context) => detailPage(context, 'anime', getAnimeEntry);

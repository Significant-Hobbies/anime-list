import { detailPage } from '../_detail-page';
import { getMangaEntry } from '../_seo-dataset';

export const onRequestGet: PagesFunction = (context) => detailPage(context, 'manga', getMangaEntry);

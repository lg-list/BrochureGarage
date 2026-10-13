"""Compare a supplied GSC URL list with current public responses; keep account exports private."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
from bs4 import BeautifulSoup
import requests

SITE = 'https://carbrochurearchive.com'


def check_page(task, sitemap, links):
    group, route = task
    url = route if route.startswith(('https://','http://')) else SITE + route
    result = {'reportedReason': group, 'url': url, 'inSitemap': url in sitemap,
              'incomingLinks': links.get(url, {}).get('incoming_internal_links', 0)}
    try:
        response = requests.get(url, headers={'User-Agent':'Mozilla/5.0'}, timeout=(15,45))
        soup = BeautifulSoup(response.content, 'html.parser')
        canonical_tag = soup.find('link', rel=lambda value:value and 'canonical' in value)
        canonical = urljoin(response.url, canonical_tag.get('href','')) if canonical_tag else None
        robots = ' '.join(tag.get('content','') for tag in soup.find_all('meta', attrs={'name':re.compile(r'^(robots|googlebot)$',re.I)}))
        header = response.headers.get('X-Robots-Tag', '')
        noindex = bool(re.search(r'\b(noindex|none)\b', robots+' '+header, re.I))
        refresh = soup.find('meta', attrs={'http-equiv':re.compile(r'^refresh$',re.I)})
        pdfs = list(dict.fromkeys(urljoin(response.url,a['href']) for a in soup.find_all('a',href=True) if 'r2.dev/pdfs/' in a['href']))
        main = soup.find('main')
        words = len((main.get_text(' ', strip=True) if main else '').split())
        result.update({'status':response.status_code,'finalUrl':response.url,'httpRedirected':bool(response.history),
                       'canonical':canonical,'metaRobots':robots,'xRobotsTag':header,'noindex':noindex,
                       'redirectChain':[{'url':hop.url,'status':hop.status_code,'to':hop.headers.get('Location')} for hop in response.history],
                       'metaRefresh':refresh.get('content') if refresh else None,
                       'title':soup.title.get_text(strip=True) if soup.title else '',
                       'pdfLinks':len(pdfs),'firstPdf':pdfs[0] if pdfs else None,'mainWords':words})
        if response.status_code == 404:
            classification = 'service_url_expected_exclusion' if route.startswith('/cdn-cgi/') else 'active_404_needs_review'
        elif response.status_code != 200:
            classification = 'http_error_needs_review'
        elif noindex and canonical == url:
            classification = 'active_noindex_needs_review'
        elif response.history or refresh or canonical != url:
            classification = 'canonical_alias_expected_exclusion'
        elif not main or not words:
            classification = 'empty_page_needs_review'
        elif route.startswith('/models/') and not pdfs:
            classification = 'empty_collection_needs_review'
        else:
            classification = 'currently_indexable_waiting_for_google'
        result['classification'] = classification
    except Exception as error:
        result.update({'classification':'request_failed_needs_review','error':str(error)})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=ROOT/'.tools/gsc-indexing-input.json')
    parser.add_argument('--output',type=Path,default=ROOT/'.tools/gsc-indexing-audit.json')
    parser.add_argument('--write-targets',action='store_true',help='Write only public canonical URLs for a focused recovery sitemap')
    args = parser.parse_args()
    source = json.loads(args.input.read_text(encoding='utf-8'))
    if source.get('property') != urlsplit(SITE).hostname:
        raise ValueError('The supplied export belongs to a different property')
    sitemap = set(re.findall(r'<loc>(.*?)</loc>',(ROOT/'sitemap.xml').read_text(encoding='utf-8')))
    link_rows = json.loads((ROOT/'seo/internal-link-report.json').read_text(encoding='utf-8'))['pages']
    links = {r['url']:r for r in link_rows}
    tasks = [(name,route) for name,group in source['groups'].items() for route in group['paths']+group.get('urls',[])]
    if args.write_targets and len(tasks) != sum(group['count'] for group in source['groups'].values()):
        raise ValueError('Capture the complete export before writing recovery targets')
    if any(urlsplit(urljoin(SITE,route)).hostname not in {'carbrochurearchive.com','www.carbrochurearchive.com'} or route.startswith('//') for _,route in tasks):
        raise ValueError('Only paths within the authorized site may be checked')
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(check_page,task,sitemap,links) for task in tasks]
        for future in as_completed(futures):
            results.append(future.result())
            if len(results)%20 == 0: print(f'Checked {len(results)}/{len(tasks)} URLs',flush=True)
    counts = {}
    for result in results:
        key = result['classification'];counts[key] = counts.get(key,0)+1
    report = {'checkedAt':datetime.now(timezone.utc).isoformat(),'reportUpdatedOn':source['reportUpdatedOn'],
              'reportedNotIndexed':source['notIndexed'],'checkedUrls':len(results),'classifications':counts,
              'remainingUrlsToCapture':source['notIndexed']-len(results),
              'results':sorted(results,key=lambda r:(r['reportedReason'],r['url']))}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.write_targets:
        targets = sorted({r['url'] for r in results if r['classification']=='currently_indexable_waiting_for_google' and r['inSitemap']})
        (ROOT/'data/indexing-recovery-targets.json').write_text(json.dumps({'description':'Reviewed canonical collection URLs for a focused sitemap refresh. No aliases or service endpoints.','urls':targets},indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2),flush=True)


if __name__ == '__main__':
    main()

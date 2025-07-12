import pandas as pd
from datetime import datetime, timedelta
import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

BASE_URL = "https://www.clubhotels.co.il/BE_Results.aspx"
PARAMS = {
    'lang': 'heb',
    'hotel': '1_1',
    'rooms': '1',
    'ad1': '2',
    'ch1': '3',
    'inf1': '0',
    '_ga': '2.78397907.694390100.1752303048-758168206.1752303047',
}

# Generate all Sun-Thu and Thu-Sun date ranges in July-August 2025
def generate_date_ranges():
    date_ranges = []
    start = datetime(2025, 7, 1)
    end = datetime(2025, 8, 31)
    curr = start
    while curr <= end:
        if curr.weekday() == 6:  # Sunday
            out = curr + timedelta(days=4)
            if out <= end:
                date_ranges.append((curr, out))
        if curr.weekday() == 3:  # Thursday
            out = curr + timedelta(days=3)
            if out <= end:
                date_ranges.append((curr, out))
        curr += timedelta(days=1)
    return date_ranges

def build_url(in_date, out_date):
    params = PARAMS.copy()
    params['in'] = in_date.strftime('%Y-%m-%d')
    params['out'] = out_date.strftime('%Y-%m-%d')
    param_str = '&'.join(f"{k}={v}" for k, v in params.items())
    return f"{BASE_URL}?{param_str}"

async def fetch_and_parse(page, in_date, out_date, results):
    url = build_url(in_date, out_date)
    print(f"Fetching: {url}")
    await page.goto(url)
    await asyncio.sleep(5)  # Give user time to inspect the page
    html = await page.content()
    soup = BeautifulSoup(html, 'html.parser')
    plan_divs = soup.find_all('div', class_='planprice')
    print(f"{in_date.strftime('%Y-%m-%d')} - {out_date.strftime('%Y-%m-%d')}: Found {len(plan_divs)} planprice divs")
    found = False
    for div in plan_divs:
        price = None
        meal_type = None
        price_span = div.find('span', class_='PriceD')
        if price_span and price_span.has_attr('price'):
            price = int(price_span['price'])
        btn = div.find_next('div', class_='matrixButton')
        if btn and btn.has_attr('roomdata'):
            roomdata = btn['roomdata']
            if 'כולל ארוחת בוקר' in roomdata:
                meal_type = 'breakfast'
            elif 'לינה בלבד' in roomdata:
                meal_type = 'room_only'
        if price and meal_type:
            results.append({
                'in': in_date.strftime('%Y-%m-%d'),
                'out': out_date.strftime('%Y-%m-%d'),
                'meal_type': meal_type,
                'price': price
            })
            found = True
    if not found:
        print(f"WARNING: No prices found for {in_date.strftime('%Y-%m-%d')} - {out_date.strftime('%Y-%m-%d')}")

async def scrape_parallel():
    date_ranges = generate_date_ranges()  # All date ranges
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Headful mode
        # Use concurrency equal to the number of URLs
        concurrency = len(date_ranges)
        pages = [await browser.new_page() for _ in range(concurrency)]
        tasks = []
        for i, (in_date, out_date) in enumerate(date_ranges):
            page = pages[i]
            tasks.append(fetch_and_parse(page, in_date, out_date, results))
        # Run all tasks in parallel
        await asyncio.gather(*tasks)
        await browser.close()
    df = pd.DataFrame(results)
    df.to_csv('clubotel_prices_parallel.csv', index=False)
    print('Saved to clubotel_prices_parallel.csv')

    # Post-process: get lowest price for each meal_type per date range
    summary = []
    for (in_date, out_date), group in df.groupby(['in', 'out']):
        row = {'in': in_date, 'out': out_date}
        for meal_type in ['room_only', 'breakfast']:
            prices = group.loc[group['meal_type'] == meal_type, 'price']
            row[meal_type] = prices.min() if not prices.empty else None
        summary.append(row)
    df_summary = pd.DataFrame(summary)
    df_summary.to_csv('lowest_two_prices_per_file.csv', index=False)
    print('Saved lowest prices to lowest_two_prices_per_file.csv')

if __name__ == '__main__':
    asyncio.run(scrape_parallel()) 
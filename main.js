import { WebContainer } from '@webcontainer/api';

class ClubotelScraper {
    constructor() {
        this.webcontainerInstance = null;
        this.isRunning = false;
        this.currentProcess = null;
        this.initializeUI();
        this.initializeWebContainer();
    }

    initializeUI() {
        // Set default dates
        const today = new Date();
        const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
        
        document.getElementById('startDate').value = today.toISOString().split('T')[0];
        document.getElementById('endDate').value = threeMonthsLater.toISOString().split('T')[0];

        // Tab functionality
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Control buttons
        document.getElementById('startScraping').addEventListener('click', () => this.startScraping());
        document.getElementById('stopScraping').addEventListener('click', () => this.stopScraping());

        // Update memory usage periodically
        setInterval(() => this.updateMemoryUsage(), 2000);
    }

    async initializeWebContainer() {
        try {
            this.updateStatus('Initializing WebContainer...');
            this.log('Initializing WebContainer...', 'log');
            
            // Initialize WebContainer
            this.webcontainerInstance = await WebContainer.boot();
            
            // Set up the file system
            await this.setupFileSystem();
            
            this.updateStatus('WebContainer ready');
            this.log('WebContainer initialized successfully!', 'success');
            this.log('Ready to run Python scraper', 'success');
            
        } catch (error) {
            this.updateStatus('Failed to initialize WebContainer');
            this.log(`Error initializing WebContainer: ${error.message}`, 'error');
        }
    }

    async setupFileSystem() {
        try {
            // Create the main Python scraper file
            const scraperCode = await this.getScraperCode();
            
            // Create requirements.txt
            const requirements = `beautifulsoup4==4.13.4
pandas==2.3.1
python-dateutil==2.9.0.post0
requests==2.31.0
lxml==4.9.3`;

            // Create a simplified scraper that works in the browser
            const browserScraper = `import asyncio
import json
import os
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import requests
from bs4 import BeautifulSoup
import pandas as pd

BASE_URL = "https://www.clubhotels.co.il/BE_Results.aspx"
PARAMS = {
    'lang': 'heb',
    'hotel': '1_1',
    'rooms': '1',
    'ad1': '2',
    'ch1': '3',
    'inf1': '0',
}

def parse_env_date(var_name: str, default: datetime) -> datetime:
    value = os.environ.get(var_name)
    if not value:
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except Exception:
        return default

def generate_date_ranges():
    default_start = datetime.now()
    default_end = default_start + relativedelta(months=3)
    start = parse_env_date('START_DATE', default_start)
    end = parse_env_date('END_DATE', default_end)

    date_ranges = []
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

def fetch_and_parse_page(in_date, out_date, nav_wait):
    url = build_url(in_date, out_date)
    print(f"Fetching: {url}")
    
    try:
        # Use requests instead of Playwright for browser compatibility
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        html = response.text
        soup = BeautifulSoup(html, 'html.parser')
        plan_divs = soup.find_all('div', class_='planprice')
        
        print(f"{in_date.strftime('%Y-%m-%d')} - {out_date.strftime('%Y-%m-%d')}: Found {len(plan_divs)} planprice divs")
        
        results = []
        found = False
        
        for div in plan_divs:
            price = None
            meal_type = None
            price_span = div.find('span', class_='PriceD')
            
            if price_span and price_span.has_attr('price'):
                try:
                    price = int(price_span['price'])
                except Exception:
                    pass
                    
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
            
        return results
        
    except Exception as e:
        print(f"Error fetching {url}: {str(e)}")
        return []

def scrape_safe():
    date_ranges = generate_date_ranges()
    results = []
    nav_wait = float(os.environ.get('SCRAPER_NAV_WAIT', '0.8'))
    
    print(f"Starting safe mode scraping for {len(date_ranges)} date ranges...")
    
    for i, (in_date, out_date) in enumerate(date_ranges):
        if os.environ.get('STOP_SCRAPING') == '1':
            print("Scraping stopped by user")
            break
            
        page_results = fetch_and_parse_page(in_date, out_date, nav_wait)
        results.extend(page_results)
        
        # Update progress
        progress = (i + 1) / len(date_ranges) * 100
        print(f"Progress: {progress:.1f}% ({i + 1}/{len(date_ranges)})")
        
        # Small delay between requests
        if i < len(date_ranges) - 1:
            import time
            time.sleep(nav_wait)
    
    return results

def main():
    print("Starting Clubotel scraper...")
    
    # Set environment variables from command line args or defaults
    start_date = os.environ.get('START_DATE')
    end_date = os.environ.get('END_DATE')
    
    if start_date:
        os.environ['START_DATE'] = start_date
    if end_date:
        os.environ['END_DATE'] = end_date
    
    # Run scraper
    results = scrape_safe()
    
    if results:
        # Save results to CSV
        df = pd.DataFrame(results)
        df.to_csv('clubotel_prices.csv', index=False)
        print(f'Saved {len(results)} results to clubotel_prices.csv')
        
        # Create summary
        summary = []
        for (in_date, out_date), group in df.groupby(['in', 'out']):
            row = {'in': in_date, 'out': out_date}
            for meal_type in ['room_only', 'breakfast']:
                prices = group.loc[group['meal_type'] == meal_type, 'price']
                row[meal_type] = prices.min() if not prices.empty else None
            summary.append(row)
            
        df_summary = pd.DataFrame(summary)
        df_summary.to_csv('lowest_prices_summary.csv', index=False)
        print(f'Saved summary to lowest_prices_summary.csv')
        
        # Print results
        print("\\nResults:")
        print(df.to_string(index=False))
        
    else:
        print("No results found")
    
    print("Scraping completed!")

if __name__ == '__main__':
    main()`;

            // Set up the file system
            await this.webcontainerInstance.mount({
                'scraper.py': {
                    file: {
                        contents: browserScraper
                    }
                },
                'requirements.txt': {
                    file: {
                        contents: requirements
                    }
                },
                'run_scraper.py': {
                    file: {
                        contents: \`import os
import sys

# Set environment variables
if len(sys.argv) > 1:
    os.environ['START_DATE'] = sys.argv[1]
if len(sys.argv) > 2:
    os.environ['END_DATE'] = sys.argv[2]

# Import and run the scraper
from scraper import main
main()\`
                }
            });

            this.log('File system setup completed', 'success');
            
        } catch (error) {
            this.log(`Error setting up file system: ${error.message}`, 'error');
            throw error;
        }
    }

    async getScraperCode() {
        // This would fetch the actual scraper code, but for now we'll use a simplified version
        return '';
    }

    async startScraping() {
        if (!this.webcontainerInstance || this.isRunning) {
            return;
        }

        try {
            this.isRunning = true;
            this.updateUIState(true);
            
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const navWait = document.getElementById('navWait').value;
            const blockImages = document.getElementById('blockImages').checked;
            
            this.log('Starting Clubotel scraper...', 'log');
            this.log(`Start Date: ${startDate}`, 'log');
            this.log(`End Date: ${endDate}`, 'log');
            this.log(`Navigation Wait: ${navWait}s`, 'log');
            this.log(`Block Images: ${blockImages}`, 'log');
            
            // Install dependencies first
            this.log('Installing Python dependencies...', 'log');
            const installProcess = await this.webcontainerInstance.spawn('pip', ['install', '-r', 'requirements.txt']);
            const installExitCode = await installProcess.exit;
            
            if (installExitCode !== 0) {
                throw new Error('Failed to install dependencies');
            }
            
            this.log('Dependencies installed successfully', 'success');
            
            // Set environment variables
            const env = {
                START_DATE: startDate,
                END_DATE: endDate,
                SCRAPER_NAV_WAIT: navWait,
                SCRAPER_BLOCK_IMAGES: blockImages ? '1' : '0'
            };
            
            // Run the scraper
            this.log('Running scraper...', 'log');
            this.currentProcess = await this.webcontainerInstance.spawn('python', ['run_scraper.py', startDate, endDate], {
                env,
                output: true
            });
            
            // Handle output
            this.currentProcess.output.pipeTo(new WritableStream({
                write(chunk) {
                    const text = new TextDecoder().decode(chunk);
                    this.log(text, 'log');
                }.bind(this)
            }));
            
            // Wait for completion
            const exitCode = await this.currentProcess.exit;
            
            if (exitCode === 0) {
                this.log('Scraping completed successfully!', 'success');
                await this.loadResults();
            } else {
                this.log(`Scraping failed with exit code: ${exitCode}`, 'error');
            }
            
        } catch (error) {
            this.log(`Error during scraping: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
            this.updateUIState(false);
        }
    }

    async stopScraping() {
        if (this.currentProcess) {
            try {
                this.currentProcess.kill();
                this.log('Scraping stopped by user', 'warning');
            } catch (error) {
                this.log(`Error stopping scraper: ${error.message}`, 'error');
            }
        }
        
        this.isRunning = false;
        this.updateUIState(false);
    }

    async loadResults() {
        try {
            // List files in the container
            const files = await this.webcontainerInstance.fs.readdir('.');
            this.updateFilesList(files);
            
            // Try to load CSV results
            if (files.includes('clubotel_prices.csv')) {
                const csvContent = await this.webcontainerInstance.fs.readFile('clubotel_prices.csv', 'utf-8');
                this.displayResults(csvContent);
            }
            
        } catch (error) {
            this.log(`Error loading results: ${error.message}`, 'error');
        }
    }

    displayResults(csvContent) {
        try {
            const lines = csvContent.split('\\n');
            const headers = lines[0].split(',');
            const data = lines.slice(1).filter(line => line.trim());
            
            let tableHTML = '<table><thead><tr>';
            headers.forEach(header => {
                tableHTML += `<th>${header.trim()}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            
            data.forEach(line => {
                const values = line.split(',');
                tableHTML += '<tr>';
                values.forEach(value => {
                    tableHTML += `<td>${value.trim()}</td>`;
                });
                tableHTML += '</tr>';
            });
            
            tableHTML += '</tbody></table>';
            
            document.getElementById('resultsTable').innerHTML = tableHTML;
            
        } catch (error) {
            this.log(`Error parsing results: ${error.message}`, 'error');
        }
    }

    updateFilesList(files) {
        const filesList = document.getElementById('filesList');
        filesList.innerHTML = '';
        
        files.forEach(file => {
            if (file.endsWith('.csv') || file.endsWith('.txt') || file.endsWith('.py')) {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = \`
                    <div class="file-info">
                        <div class="file-name">\${file}</div>
                        <div class="file-size">File</div>
                    </div>
                    <button class="download-btn" onclick="this.downloadFile('\${file}')">Download</button>
                \`;
                filesList.appendChild(fileItem);
            }
        });
    }

    async downloadFile(filename) {
        try {
            const content = await this.webcontainerInstance.fs.readFile(filename, 'utf-8');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.log(`Downloaded ${filename}`, 'success');
        } catch (error) {
            this.log(`Error downloading ${filename}: ${error.message}`, 'error');
        }
    }

    updateUIState(isRunning) {
        document.getElementById('startScraping').disabled = isRunning;
        document.getElementById('stopScraping').disabled = !isRunning;
        
        if (isRunning) {
            document.getElementById('progressText').textContent = 'Scraping in progress...';
            document.getElementById('progressFill').style.width = '0%';
        } else {
            document.getElementById('progressText').textContent = 'Ready to start';
            document.getElementById('progressFill').style.width = '0%';
        }
    }

    switchTab(tabName) {
        // Hide all tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab pane
        document.getElementById(tabName).classList.add('active');
        
        // Add active class to clicked button
        document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');
    }

    log(message, type = 'log') {
        const consoleOutput = document.getElementById('consoleOutput');
        const logEntry = document.createElement('div');
        logEntry.className = \`log \${type}\`;
        logEntry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
        consoleOutput.appendChild(logEntry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }

    updateMemoryUsage() {
        if (performance.memory) {
            const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            const totalMB = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
            document.getElementById('memoryUsage').textContent = \`Memory: \${memoryMB}MB / \${totalMB}MB\`;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ClubotelScraper();
});

// Global function for file downloads
window.downloadFile = function(filename) {
    // This will be handled by the ClubotelScraper instance
    console.log('Download requested for:', filename);
};

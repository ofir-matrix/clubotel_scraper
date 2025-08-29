# 🏨 Clubotel Scraper - Client Side

A **client-side web scraping solution** that runs Python code directly in your browser using **WebContainers** - no server needed!

## ✨ Features

- **🚀 No Server Required**: Runs entirely in your browser
- **🐍 Python Execution**: Full Python environment with package management
- **🌐 Web Scraping**: Scrapes Clubotel hotel prices directly from the website
- **📊 Real-time Results**: View scraping progress and results in real-time
- **💾 File Downloads**: Download CSV results directly to your computer
- **🎨 Modern UI**: Beautiful, responsive interface with progress tracking
- **📱 Mobile Friendly**: Works on desktop and mobile devices

## 🚀 Quick Start

### Option 1: Run Locally (Recommended)

1. **Install Node.js** (version 18 or higher)
   ```bash
   # Download from https://nodejs.org/
   # Or use a package manager
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Application**
   ```bash
   npm start
   ```

4. **Open Your Browser**
   Navigate to `http://localhost:8080`

### Option 2: Use with Live Server (VS Code)

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 3: Deploy to GitHub Pages

1. Push your code to a GitHub repository
2. Go to Settings → Pages
3. Select source branch and save
4. Your app will be available at `https://username.github.io/repository-name`

## 🔧 How It Works

### WebContainers Technology

This application uses **WebContainers** - a technology that runs Linux containers directly in your browser:

- **Full Linux Environment**: Complete Ubuntu-based container
- **Python Support**: Python 3.11 with pip package management
- **File System**: Virtual file system that persists during the session
- **Process Management**: Run multiple Python processes
- **Network Access**: Make HTTP requests to external websites

### Scraping Process

1. **Initialize Container**: WebContainer boots up with Python environment
2. **Install Dependencies**: Automatically installs required Python packages
3. **Run Scraper**: Executes the Python scraper with your parameters
4. **Real-time Output**: Shows progress and results as they happen
5. **Download Results**: Save CSV files directly to your computer

## 📋 Requirements

### Browser Compatibility

- **Chrome/Edge**: Version 102+ (Full support)
- **Firefox**: Version 113+ (Full support)
- **Safari**: Version 16+ (Full support)

### System Requirements

- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: At least 1GB free space
- **Internet**: Stable connection for initial setup and scraping

## 🎛️ Configuration

### Scraping Parameters

- **Start Date**: When to begin scraping (default: today)
- **End Date**: When to stop scraping (default: 3 months from now)
- **Scraper Mode**: 
  - Safe Mode: Sequential requests (slower, more reliable)
  - Fast Mode: Parallel requests (faster, may trigger rate limits)
- **Navigation Wait**: Delay between requests in seconds
- **Block Images**: Reduce bandwidth by blocking image downloads

### Environment Variables

The scraper automatically sets these environment variables:
- `START_DATE`: Start date for scraping
- `END_DATE`: End date for scraping
- `SCRAPER_NAV_WAIT`: Wait time between requests
- `SCRAPER_BLOCK_IMAGES`: Whether to block image downloads

## 📁 File Structure

```
clubotel-scraper-client/
├── index.html          # Main HTML interface
├── styles.css          # CSS styling
├── main.js            # JavaScript application logic
├── package.json       # Node.js dependencies
├── README_CLIENT.md   # This file
└── scraper.py         # Original Python scraper (for reference)
```

## 🔍 Understanding the Output

### Console Tab
- **Real-time Logs**: See what the scraper is doing
- **Progress Updates**: Track scraping completion percentage
- **Error Messages**: Identify and troubleshoot issues

### Results Tab
- **Data Table**: View scraped hotel prices in a table format
- **Columns**: Check-in date, check-out date, meal type, price
- **Sorting**: Click column headers to sort data

### Files Tab
- **Generated Files**: List of CSV files created by the scraper
- **Download Buttons**: Download results directly to your computer
- **File Types**: CSV files with hotel price data

## 🚨 Important Notes

### CORS and Web Scraping

- **Same-Origin Policy**: WebContainers run in your browser, so CORS restrictions apply
- **External Websites**: Some websites may block requests from browsers
- **Rate Limiting**: Be respectful of website resources and use appropriate delays

### Browser Limitations

- **Memory Usage**: Large scraping jobs may use significant browser memory
- **Tab Management**: Keep the scraper tab active for best performance
- **Network Stability**: Unstable internet may cause scraping failures

### Data Privacy

- **Local Processing**: All data is processed locally in your browser
- **No Server Storage**: Your scraping data never leaves your computer
- **Temporary Files**: Generated files are stored in the virtual container

## 🛠️ Troubleshooting

### Common Issues

1. **WebContainer Won't Initialize**
   - Check browser compatibility
   - Ensure stable internet connection
   - Try refreshing the page

2. **Dependencies Won't Install**
   - Check internet connection
   - Verify Python packages are available on PyPI
   - Check browser console for error messages

3. **Scraping Fails**
   - Verify target website is accessible
   - Check if website structure has changed
   - Increase navigation wait time
   - Check browser console for detailed errors

4. **Memory Issues**
   - Close other browser tabs
   - Reduce scraping date range
   - Use safe mode instead of fast mode

### Debug Mode

Enable detailed logging by opening browser console (F12):
- **Network Tab**: Monitor HTTP requests
- **Console Tab**: View JavaScript errors and logs
- **Performance Tab**: Monitor memory usage

## 🔮 Future Enhancements

- **Export Options**: Support for Excel, JSON, and other formats
- **Scheduling**: Run scraping jobs at specific times
- **Notifications**: Browser notifications when scraping completes
- **Data Visualization**: Charts and graphs for price trends
- **Multiple Hotels**: Scrape multiple hotel chains simultaneously
- **API Integration**: Connect to hotel booking APIs

## 📚 Technical Details

### WebContainer Architecture

- **Linux Kernel**: Virtualized Linux environment
- **File System**: Virtual file system with persistence
- **Process Management**: Full process isolation and management
- **Network Stack**: Complete TCP/IP networking support
- **Package Management**: apt, pip, npm, and other package managers

### Python Environment

- **Python Version**: 3.11
- **Package Manager**: pip with PyPI access
- **Key Libraries**: requests, beautifulsoup4, pandas, python-dateutil
- **Dependencies**: Automatically installed from requirements.txt

### Security Features

- **Sandboxed Execution**: All code runs in isolated container
- **No System Access**: Cannot access host file system
- **Network Isolation**: Limited to HTTP/HTTPS requests
- **Memory Limits**: Automatic memory management and cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **WebContainers Team**: For the amazing container technology
- **Python Community**: For the excellent web scraping libraries
- **Clubotel**: For providing the hotel data (please respect their terms of service)

## 📞 Support

If you encounter issues or have questions:

1. Check the troubleshooting section above
2. Review browser console for error messages
3. Ensure your setup meets all requirements
4. Consider opening an issue on GitHub

---

**Happy Scraping! 🚀**

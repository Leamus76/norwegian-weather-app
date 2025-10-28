// Weather API configuration
const WEATHER_API_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

// Norwegian cities database
const NORWEGIAN_CITIES = {
    'oslo': { name: 'Oslo', address: 'Grev Wedels plass 9', lat: 59.9139, lon: 10.7522 },
    'bergen': { name: 'Bergen', address: 'Bryggen', lat: 60.3913, lon: 5.3221 },
    'trondheim': { name: 'Trondheim', address: 'Nidarosdomen', lat: 63.4305, lon: 10.3951 },
    'stavanger': { name: 'Stavanger', address: 'Gamle Stavanger', lat: 58.9699, lon: 5.7331 },
    'tromso': { name: 'Tromsø', address: 'Arktisk katedral', lat: 69.6492, lon: 18.9553 },
    'bodo': { name: 'Bodø', address: 'Saltstraumen', lat: 67.2804, lon: 14.4049 },
    'kristiansand': { name: 'Kristiansand', address: 'Posebyen', lat: 58.1467, lon: 7.9956 },
    'alesund': { name: 'Ålesund', address: 'Art Nouveau sentrum', lat: 62.4722, lon: 6.1549 },
    'fredrikstad': { name: 'Fredrikstad', address: 'Gamlebyen', lat: 59.2181, lon: 10.9378 },
    'drammen': { name: 'Drammen', address: 'Spiralen', lat: 59.7440, lon: 10.2044 }
};

const DAY_NAMES = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const MONTH_NAMES = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

class WeatherApp {
    constructor() {
        this.currentWeather = null;
        this.forecast = [];
        this.currentCityKey = 'oslo';
        this.init();
    }

    async init() {
        try {
            this.handleMobileCitySelection();
            await this.loadWeatherData();
            this.updateTime();
            this.updateWeatherDisplay();
            this.updateForecastDisplay();
            this.updateCityInfo();
            document.querySelector('.weather-app').classList.add('ready');
            
            setTimeout(() => {
                try {
                    this.generateQRCode();
                } catch (error) {
                    console.warn('⚠️ QR code generation failed, but app continues:', error);
                }
            }, 100);
            
            setInterval(() => this.updateTime(), 60000);
            setInterval(() => this.loadWeatherData(), 600000);
        } catch (error) {
            console.error('Failed to initialize weather app:', error);
            this.showError();
            document.querySelector('.weather-app').classList.add('ready');
        }
    }

    async loadWeatherData() {
        try {
            const city = NORWEGIAN_CITIES[this.currentCityKey];
            console.log(`🌤️ Fetching weather data for ${city.name} from yr.no API...`);
            const response = await fetch(`${WEATHER_API_BASE}?lat=${city.lat}&lon=${city.lon}`, {
                headers: {
                    'User-Agent': 'NorwegianWeatherApp/1.0 contact@zetadisplay.com',
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.processWeatherData(data);
        } catch (error) {
            console.error('❌ Failed to load weather data:', error);
            throw error;
        }
    }

    processWeatherData(data) {
        if (!data.properties || !data.properties.timeseries) {
            throw new Error('Invalid weather data format');
        }

        const timeseries = data.properties.timeseries;
        const now = new Date();
        
        let closestIndex = 0;
        let closestTime = new Date(timeseries[0].time);
        let minDiff = Math.abs(now - closestTime);
        
        for (let i = 1; i < timeseries.length; i++) {
            const time = new Date(timeseries[i].time);
            const diff = Math.abs(now - time);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
                closestTime = time;
            }
        }
        
        this.currentWeather = timeseries[closestIndex];
        
        this.forecast = [];
        const forecastStart = closestIndex + 1;
        
        for (let i = 0; i < 2; i++) {
            const targetDay = new Date(now);
            targetDay.setDate(targetDay.getDate() + i + 1);
            targetDay.setHours(12, 0, 0, 0);
            
            let bestIndex = -1;
            let bestDiff = Infinity;
            
            for (let j = forecastStart; j < timeseries.length; j++) {
                const dataTime = new Date(timeseries[j].time);
                const dayDiff = Math.abs(dataTime - targetDay);
                
                if (dataTime.getDate() === targetDay.getDate() && 
                    dataTime.getMonth() === targetDay.getMonth() && 
                    dataTime.getFullYear() === targetDay.getFullYear()) {
                    
                    if (dayDiff < bestDiff) {
                        bestDiff = dayDiff;
                        bestIndex = j;
                    }
                }
            }
            
            if (bestIndex === -1) {
                const fallbackIndex = forecastStart + (i * 12);
                if (fallbackIndex < timeseries.length) {
                    bestIndex = fallbackIndex;
                }
            }
            
            if (bestIndex !== -1 && bestIndex < timeseries.length) {
                const forecastDate = new Date(timeseries[bestIndex].time);
                this.forecast.push({
                    data: timeseries[bestIndex],
                    forecastDate: forecastDate,
                    dayName: DAY_NAMES[forecastDate.getDay()]
                });
            }
        }
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('no-NO', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        const dateString = this.formatDate(now);
        
        document.getElementById('currentTime').textContent = timeString;
        document.getElementById('currentDate').textContent = dateString;
    }

    formatDate(date) {
        const dayName = DAY_NAMES[date.getDay()];
        const day = date.getDate();
        const monthName = MONTH_NAMES[date.getMonth()];
        return `${dayName} ${day}. ${monthName}`;
    }

    updateWeatherDisplay() {
        if (!this.currentWeather) return;
        
        const data = this.currentWeather.data;
        const instant = data.instant;
        const next1Hour = data.next_1_hours;
        
        const temp = Math.round(instant.details.air_temperature);
        document.getElementById('currentTemp').textContent = `${temp}°`;
        
        let symbolCode = null;
        if (next1Hour && next1Hour.summary && next1Hour.summary.symbol_code) {
            symbolCode = next1Hour.summary.symbol_code;
        } else if (data.next_6_hours && data.next_6_hours.summary && data.next_6_hours.summary.symbol_code) {
            symbolCode = data.next_6_hours.summary.symbol_code;
        } else {
            const cloudCover = instant.details.cloud_area_fraction;
            const precipitation = next1Hour ? next1Hour.details.precipitation_amount : 0;
            const airTemp = instant.details.air_temperature;
            
            if (precipitation > 0) {
                if (airTemp < 0) {
                    symbolCode = precipitation > 2 ? 'heavysnow_day' : 'snow_day';
                } else {
                    symbolCode = precipitation > 2 ? 'heavyrain_day' : 'rain_day';
                }
            } else if (cloudCover > 75) {
                symbolCode = 'cloudy';
            } else if (cloudCover > 25) {
                symbolCode = 'partlycloudy_day';
            } else {
                symbolCode = 'clearsky_day';
            }
        }
        
        const description = this.getWeatherDescription(symbolCode);
        document.getElementById('currentDescription').textContent = description;
        
        const precipitation = next1Hour ? next1Hour.details.precipitation_amount : 0;
        document.getElementById('rainAmount').textContent = `${precipitation}mm`;
        
        const windSpeed = Math.round(instant.details.wind_speed);
        document.getElementById('windSpeed').textContent = `${windSpeed} m/s`;
        
        this.updateWeatherIcon('currentWeatherIcon', symbolCode);
    }

    updateForecastDisplay() {
        this.forecast.forEach((forecast, index) => {
            if (!forecast || !forecast.data) return;
            
            const timeseriesEntry = forecast.data;
            const instant = timeseriesEntry.data ? timeseriesEntry.data.instant : timeseriesEntry.instant;
            if (!instant || !instant.details) return;
            
            const dayNameElement = document.getElementById(`day-name${index + 1}`);
            if (dayNameElement && forecast.dayName) {
                dayNameElement.textContent = forecast.dayName;
            }
            
            const temp = Math.round(instant.details.air_temperature);
            document.getElementById(`forecastHigh${index + 1}`).textContent = `${temp}°`;
            
            let lowTemp = temp - 3;
            document.getElementById(`forecastLow${index + 1}`).textContent = `${lowTemp}°`;
            
            const next6Hours = timeseriesEntry.data ? timeseriesEntry.data.next_6_hours : timeseriesEntry.next_6_hours;
            let symbolCode = null;
            
            if (next6Hours && next6Hours.summary && next6Hours.summary.symbol_code) {
                symbolCode = next6Hours.summary.symbol_code;
            } else {
                const cloudCover = instant.details.cloud_area_fraction;
                if (cloudCover > 75) {
                    symbolCode = 'cloudy';
                } else if (cloudCover > 25) {
                    symbolCode = 'partlycloudy_day';
                } else {
                    symbolCode = 'clearsky_day';
                }
            }
            
            const description = this.getWeatherDescription(symbolCode);
            document.getElementById(`forecastDesc${index + 1}`).textContent = description;
            
            const precipitation = next6Hours && next6Hours.details ? next6Hours.details.precipitation_amount : 0;
            document.getElementById(`forecastRain${index + 1}`).textContent = `${precipitation}mm`;
            
            const windSpeed = Math.round(instant.details.wind_speed);
            document.getElementById(`forecastWind${index + 1}`).textContent = `${windSpeed} m/s`;
            
            this.updateWeatherIcon(`forecastIcon${index + 1}`, symbolCode);
        });
    }

    updateWeatherIcon(elementId, symbolCode) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const iconMap = {
            'clearsky_day': 'day.svg',
            'clearsky_night': 'night.svg',
            'fair_day': 'cloudy-day-1.svg',
            'fair_night': 'cloudy-night-1.svg',
            'partlycloudy_day': 'cloudy-day-2.svg',
            'partlycloudy_night': 'cloudy-night-2.svg',
            'cloudy': 'cloudy.svg',
            'rain_day': 'rainy-3.svg',
            'rain_night': 'rainy-3.svg',
            'heavyrain_day': 'rainy-5.svg',
            'heavyrain_night': 'rainy-5.svg',
            'heavyrain': 'rainy-5.svg',
            'rainshowers_day': 'rainy-2.svg',
            'rainshowers_night': 'rainy-2.svg',
            'snow_day': 'snowy-3.svg',
            'snow_night': 'snowy-3.svg',
            'heavysnow_day': 'snowy-5.svg',
            'heavysnow_night': 'snowy-5.svg',
            'thunderstorm_day': 'thunder.svg',
            'thunderstorm_night': 'thunder.svg',
            'windy_day': 'cloudy.svg',
            'windy_night': 'cloudy.svg',
            'sleet_day': 'snowy-2.svg',
            'sleet_night': 'snowy-2.svg',
            'fog': 'cloudy.svg',
            'default': 'cloudy.svg'
        };
        
        const iconFileName = iconMap[symbolCode] || 'cloudy.svg';
        element.innerHTML = `<img src="weather_icons/animated/${iconFileName}" style="width: 100%; height: 100%; object-fit: contain;" />`;
    }

    getWeatherDescription(symbolCode) {
        const descriptionMap = {
            'clearsky_day': 'Klart',
            'clearsky_night': 'Klart',
            'fair_day': 'Delvis skyet',
            'fair_night': 'Delvis skyet',
            'partlycloudy_day': 'Delvis skyet',
            'partlycloudy_night': 'Delvis skyet',
            'cloudy': 'Overskyet',
            'rainshowers_day': 'Regnbyger',
            'rainshowers_night': 'Regnbyger',
            'rain_day': 'Regn',
            'rain_night': 'Regn',
            'heavyrain_day': 'Kraftig regn',
            'heavyrain_night': 'Kraftig regn',
            'heavyrain': 'Kraftig regn',
            'snow_day': 'Snø',
            'snow_night': 'Snø',
            'heavysnow_day': 'Kraftig snø',
            'heavysnow_night': 'Kraftig snø',
            'sleet_day': 'Sludd',
            'sleet_night': 'Sludd',
            'fog': 'Tåke'
        };
        
        const description = descriptionMap[symbolCode];
        if (description) {
            return description;
        } else {
            if (symbolCode.includes('clear')) return 'Klart';
            if (symbolCode.includes('cloud')) return 'Overskyet';
            if (symbolCode.includes('rain')) return 'Regn';
            if (symbolCode.includes('snow')) return 'Snø';
            if (symbolCode.includes('fog')) return 'Tåke';
            return 'Overskyet';
        }
    }

    showError() {
        document.getElementById('currentTemp').textContent = '--°';
        document.getElementById('currentDescription').textContent = 'Feil ved lasting';
        document.getElementById('rainAmount').textContent = '--mm';
        document.getElementById('windSpeed').textContent = '-- m/s';
    }

    async switchCity(cityKey) {
        if (!NORWEGIAN_CITIES[cityKey]) {
            console.error(`❌ Unknown city: ${cityKey}`);
            return;
        }
        
        console.log(`🏙️ Switching to city: ${NORWEGIAN_CITIES[cityKey].name}`);
        this.currentCityKey = cityKey;
        
        this.updateCityInfo();
        
        try {
            await this.loadWeatherData();
            this.updateWeatherDisplay();
            this.updateForecastDisplay();
            console.log(`✅ Successfully switched to ${NORWEGIAN_CITIES[cityKey].name}`);
        } catch (error) {
            console.error(`❌ Failed to load weather for ${NORWEGIAN_CITIES[cityKey].name}:`, error);
        }
    }

    updateCityInfo() {
        const city = NORWEGIAN_CITIES[this.currentCityKey];
        document.querySelector('.city-name').textContent = city.name;
        document.querySelector('.location-detail').textContent = city.address;
    }

    generateQRCode() {
        let baseUrl;
        if (window.location.protocol === 'file:') {
            baseUrl = 'https://leamus76.github.io/norwegian-weather-app';
        } else {
            baseUrl = window.location.origin + window.location.pathname;
        }
        
        const qrUrl = `${baseUrl}?mobile=true&city=${this.currentCityKey}`;
        
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            
            if (typeof QRCode !== 'undefined') {
                try {
                    const qr = new QRCode(qrContainer, {
                        text: qrUrl,
                        width: 80,
                        height: 80,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                    
                    console.log(`📱 Generated QR code for: ${qrUrl}`);
                } catch (error) {
                    console.warn('⚠️ QR code generation failed, using fallback:', error);
                    this.generateQRCodeFallback(qrUrl);
                }
            } else {
                console.warn('⚠️ QR code library not loaded, using fallback');
                this.generateQRCodeFallback(qrUrl);
            }
        }
    }

    generateQRCodeFallback(qrUrl) {
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            const qrImageUrl = `https://chart.googleapis.com/chart?chs=80x80&cht=qr&chl=${encodeURIComponent(qrUrl)}`;
            qrContainer.innerHTML = `
                <img src="${qrImageUrl}" 
                     alt="QR Code" 
                     style="width: 100%; height: 100%; object-fit: contain;" 
                     onerror="this.parentElement.innerHTML='<div style=\\'color:#6ab6ff;text-align:center;padding:20px;\\'>QR-kode ikke tilgjengelig<br><small>Bruk URL: ${qrUrl}</small></div>'"
                />
            `;
            console.log(`📱 Generated fallback QR code for: ${qrUrl}`);
        }
    }

    handleMobileCitySelection() {
        const urlParams = new URLSearchParams(window.location.search);
        const isMobile = urlParams.get('mobile') === 'true';
        const cityParam = urlParams.get('city');
        
        if (isMobile && cityParam) {
            this.showMobileCitySelector(cityParam);
        } else if (isMobile) {
            this.showMobileCitySelector();
        }
    }

    showMobileCitySelector(selectedCity = null) {
        const mobileInterface = document.createElement('div');
        mobileInterface.id = 'mobileCitySelector';
        mobileInterface.innerHTML = `
            <div class="mobile-city-selector">
                <h2>Velg by</h2>
                <div class="city-list">
                    ${Object.entries(NORWEGIAN_CITIES).map(([key, city]) => `
                        <button class="city-option ${key === selectedCity ? 'selected' : ''}" 
                                data-city="${key}" 
                                onclick="window.selectCity('${key}')">
                            <span class="city-name">${city.name}</span>
                            <span class="city-address">${city.address}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="mobile-actions">
                    <button onclick="window.confirmCitySelection()" class="confirm-btn">Bekreft</button>
                    <button onclick="window.cancelCitySelection()" class="cancel-btn">Avbryt</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(mobileInterface);
        window.tempSelectedCity = selectedCity || this.currentCityKey;
        console.log('📱 Mobile city selector displayed');
    }

    hideMobileCitySelector() {
        const selector = document.getElementById('mobileCitySelector');
        if (selector) {
            selector.remove();
        }
    }
}

// Global functions for mobile city selection
window.selectCity = function(cityKey) {
    console.log(`🏙️ City selected: ${cityKey}`);
    window.tempSelectedCity = cityKey;
    
    document.querySelectorAll('.city-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.querySelector(`[data-city="${cityKey}"]`).classList.add('selected');
};

window.confirmCitySelection = function() {
    if (window.tempSelectedCity && window.weatherApp) {
        console.log(`✅ Confirming city selection: ${window.tempSelectedCity}`);
        
        window.weatherApp.switchCity(window.tempSelectedCity);
        window.weatherApp.hideMobileCitySelector();
        
        const baseUrl = window.location.origin + window.location.pathname;
        window.location.href = baseUrl;
    }
};

window.cancelCitySelection = function() {
    console.log('❌ City selection cancelled');
    
    if (window.weatherApp) {
        window.weatherApp.hideMobileCitySelector();
    }
    
    const baseUrl = window.location.origin + window.location.pathname;
    window.location.href = baseUrl;
};

// Initialize the weather app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const weatherApp = new WeatherApp();
    window.weatherApp = weatherApp;
    
    // Add test functions for debugging
    window.testQRCode = function() {
        console.log('🧪 Testing QR code generation...');
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            console.log('QR Container found:', qrContainer);
            console.log('QR Container content:', qrContainer.innerHTML);
        } else {
            console.error('QR Container not found!');
        }
        
        let baseUrl;
        if (window.location.protocol === 'file:') {
            baseUrl = 'https://leamus76.github.io/norwegian-weather-app';
        } else {
            baseUrl = window.location.origin + window.location.pathname;
        }
        const testUrl = `${baseUrl}?mobile=true&city=oslo`;
        console.log('Generated URL:', testUrl);
        console.log('Current location:', window.location.href);
    };
});
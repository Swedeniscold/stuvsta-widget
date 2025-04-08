// api/realtid.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const siteId = 9525; // Stuvsta pendeltågsstation
  const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("API svarade med fel:", response.status);
      return res.status(response.status).json({ error: "Fel vid anrop till SL API" });
    }
    
    const data = await response.json();
    console.log("API-svar mottaget, antal avgångar:", data.departures ? data.departures.length : 0);

    if (!data || !data.departures) {
      console.log("Ingen data från SL Transport");
      return res.status(500).json({ error: "Ingen avgångsinformation hittades" });
    }

    // Filtrera norrgående pendeltåg
    const trains = data.departures
      .filter(dep => {
        // Kontrollera att det är ett pendeltåg
        const lineInfo = dep.line || {};
        const isTrainMode = lineInfo.transport_mode === "TRAIN";
        const isPendeltag = lineInfo.group_of_lines === "Pendeltåg";
        
        // Kontrollera att destinationen är norrgående
        const destination = (dep.destination || "").toLowerCase();
        const northDestinations = ["märsta", "uppsala", "stockholm", "arlanda"];
        const isNorthbound = northDestinations.some(dest => destination.includes(dest));
        
        return isTrainMode && isPendeltag && isNorthbound;
      })
      .map(dep => ({
        line: dep.line?.designation || "Pendeltåg",
        destination: dep.destination || "Okänd",
        displayTime: dep.display || dep.scheduled || "Okänd tid"
      }));

    console.log("Filtrerade fram", trains.length, "norrgående pendeltåg");
    
    // Tillåt CORS för enklare testning
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    res.status(200).json({ departures: trains });
  } catch (err) {
    console.error("Fel vid hämtning av SL-data:", err);
    res.status(500).json({ error: "Kunde inte hämta avgångsinformation" });
  }

  // Lägg till detta i din <script>-del efter dina andra funktioner:

// Funktion för att uppdatera all data
function refreshData() {
  // Hämta väderdata på nytt
  Promise.all([
    fetch(currentWeatherUrl).then(res => res.json()),
    fetch(forecastUrl).then(res => res.json())
  ])
  .then(([currentData, forecastData]) => {
    // Uppdatera väder (samma kod som tidigare)
    const container = document.getElementById("weather");
    // ... resten av din väderkod ...
  })
  .catch(err => {
    console.error("Fel vid uppdatering av väder:", err);
  });

  // Hämta avgångar på nytt
  fetch('https://din-vercel-app-domän.vercel.app/api/realtid')
    .then(res => res.json())
    .then(data => {
      // Uppdatera avgångar (samma kod som tidigare)
      const container = document.getElementById("departures");
      // ... resten av din avgångskod ...
    })
    .catch(err => {
      console.error("Fel vid uppdatering av avgångar:", err);
    });
    
  console.log("Data uppdaterad:", new Date().toLocaleTimeString());
}

// Ställ in automatisk uppdatering var 5:e minut (300000 millisekunder)
const updateInterval = 5 * 60 * 1000; // 5 minuter
setInterval(refreshData, updateInterval);

// Visa senaste uppdateringstid
const updateTimeElement = document.createElement('div');
updateTimeElement.id = 'update-time';
updateTimeElement.style.fontSize = '0.8rem';
updateTimeElement.style.color = '#666';
updateTimeElement.style.textAlign = 'center';
updateTimeElement.style.padding = '0.5rem';
document.body.appendChild(updateTimeElement);

function updateRefreshTime() {
  const now = new Date();
  updateTimeElement.textContent = `Senast uppdaterad: ${now.toLocaleTimeString()}`;
}

// Uppdatera tiden när sidan först laddas
updateRefreshTime();
// Uppdatera tiden efter varje datauppdatering
setInterval(updateRefreshTime, updateInterval);
};

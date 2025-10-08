// api/realtid.js
const fetch = require('node-fetch');

// Hjälpfunktion för att göra fetch med timeout
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Retry-logik
async function fetchWithRetry(url, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Försök ${i + 1}/${maxRetries} att hämta data...`);
      const response = await fetchWithTimeout(url, {}, 8000);
      
      if (response.ok) {
        return response;
      }
      
      console.log(`Försök ${i + 1} misslyckades med status: ${response.status}`);
      
      // Om det är sista försöket, returnera responsen ändå
      if (i === maxRetries - 1) {
        return response;
      }
      
      // Vänta lite innan nästa försök
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Försök ${i + 1} gav fel:`, error.message);
      
      // Om det är sista försöket, kasta felet
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Vänta lite innan nästa försök
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = async (req, res) => {
  const siteId = 9528; // Stuvsta station
  const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures`;

  try {
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      console.error("API svarade med fel:", response.status);
      return res.status(response.status).json({ 
        error: "Fel vid anrop till SL API",
        status: response.status,
        message: "SL:s API svarar inte korrekt just nu. Försök igen om en stund."
      });
    }
    
    const data = await response.json();
    console.log("API-svar mottaget, antal avgångar:", data.departures ? data.departures.length : 0);
    
    // Logga namnet på stationen vi faktiskt får data för
    if (data.departures && data.departures.length > 0 && data.departures[0].stop_area) {
      console.log("Hämtade avgångar från station:", data.departures[0].stop_area.name);
    }

    if (!data || !data.departures) {
      console.log("Ingen data från SL Transport");
      return res.status(500).json({ 
        error: "Ingen avgångsinformation hittades",
        message: "SL:s API returnerade ingen data"
      });
    }

    // Filtrera norrgående pendeltåg
    const trains = data.departures
      .filter(dep => {
        // Kontrollera att det är ett pendeltåg
        const lineInfo = dep.line || {};
        const isTrainMode = lineInfo.transport_mode === "TRAIN";
        const isPendeltag = lineInfo.group_of_lines === "Pendeltåg";
        
        // Riktningskod 2 är norrut baserat på testresultaten
        const isNorthbound = dep.direction_code === 2;
        
        return isTrainMode && isPendeltag && isNorthbound;
      })
      .map(dep => ({
        line: dep.line?.designation || "Pendeltåg",
        destination: dep.destination || "Okänd",
        displayTime: dep.display || "Okänd tid",
        scheduledTime: dep.scheduled || null,
        isDelayed: dep.state === "DELAYED",
        isCancelled: dep.state === "CANCELLED"
      }));

    console.log("Filtrerade fram", trains.length, "norrgående pendeltåg");
    
    // Tillåt CORS för enklare testning
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    
    res.status(200).json({ 
      departures: trains,
      timestamp: new Date().toISOString(),
      source: "SL Transport API"
    });
    
  } catch (err) {
    console.error("Fel vid hämtning av SL-data:", err);
    
    // Ge mer specifik information baserat på feltypen
    let errorMessage = "Kunde inte hämta avgångsinformation";
    if (err.name === 'AbortError') {
      errorMessage = "Timeout - SL:s API svarar inte";
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      errorMessage = "Kan inte ansluta till SL:s API";
    }
    
    res.status(503).json({ 
      error: errorMessage,
      details: err.message,
      suggestion: "SL:s API har problem just nu. Försök igen om några minuter."
    });
  }
};

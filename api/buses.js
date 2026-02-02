// api/buses.js - HELT SEPARAT från pendeltågen
// Ta bort denna fil för att inaktivera bussinformationen
const fetch = require('node-fetch');

// Cache för att hantera timeout-problem (samma som i realtid.js)
let cache = {
  data: null,
  timestamp: null,
  maxAge: 10 * 60 * 1000 // 10 minuter
};

async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

module.exports = async (req, res) => {
  // BYT UT DETTA SITE ID när du har hittat rätt nummer för Skeppsmyreparken
  const busSiteId = 7065; // <-- ÄNDRA DETTA till Skeppsmyreparkens site ID
  
  const url = `https://transport.integration.sl.se/v1/sites/${busSiteId}/departures`;

  try {
    console.log("Försöker hämta bussar från Skeppsmyreparken...");
    const response = await fetchWithTimeout(url, 5000);
    
    if (!response.ok) {
      console.error("SL API svarade med fel för bussar:", response.status);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.departures) {
      console.log("Ingen bussdata från SL API");
      throw new Error("Ingen data");
    }

    // Filtrera norrgående bussar
    const buses = data.departures
      .filter(dep => {
        const lineInfo = dep.line || {};
        const isBusMode = lineInfo.transport_mode === "BUS";
        
        // Riktningskod för norrut - kontrollera vad som är rätt för denna hållplats
        // Du kan behöva justera detta baserat på vilka destinationer som är norrgående
        const isNorthbound = dep.direction_code === 2 || 
                             dep.destination?.toLowerCase().includes("stuvsta") ||
                             dep.destination?.toLowerCase().includes("stockholm") ||
                             dep.destination?.toLowerCase().includes("city");
        
        return isBusMode && isNorthbound;
      })
      .map(dep => ({
        line: dep.line?.designation || "Buss",
        destination: dep.destination || "Okänd",
        displayTime: dep.display || "Okänd tid",
        scheduledTime: dep.scheduled || null,
        isDelayed: dep.state === "DELAYED",
        isCancelled: dep.state === "CANCELLED"
      }));

    console.log("✅ Hämtade", buses.length, "norrgående bussar");
    
    // Spara i cache
    cache.data = buses;
    cache.timestamp = Date.now();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    
    res.status(200).json({ 
      departures: buses,
      timestamp: new Date().toISOString(),
      source: "SL API (live)",
      cached: false
    });
    
  } catch (err) {
    console.error("❌ Buss-API fel:", err.message);
    
    // Försök använda cachad data
    if (cache.data && cache.timestamp) {
      const age = Date.now() - cache.timestamp;
      const ageMinutes = Math.floor(age / 60000);
      
      console.log(`⚠️ Använder cachad bussdata (${ageMinutes} min gammal)`);
      
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      
      return res.status(200).json({ 
        departures: cache.data,
        timestamp: new Date(cache.timestamp).toISOString(),
        source: "SL API (cached)",
        cached: true,
        cacheAge: ageMinutes,
        warning: "SL:s API svarar inte - visar senast hämtad data"
      });
    }
    
    // Ingen cache finns
    console.error("💥 Ingen busscache tillgänglig");
    res.status(503).json({ 
      error: "SL:s API svarar inte och ingen cachad data finns",
      details: err.message
    });
  }
};

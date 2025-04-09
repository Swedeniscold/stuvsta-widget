// api/realtid.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const siteId = 9528; // Stuvsta station
  const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("API svarade med fel:", response.status);
      return res.status(response.status).json({ error: "Fel vid anrop till SL API" });
    }
    
    const data = await response.json();
    console.log("API-svar mottaget, antal avgångar:", data.departures ? data.departures.length : 0);
    
    // Logga namnet på stationen vi faktiskt får data för
    if (data.departures && data.departures.length > 0 && data.departures[0].stop_area) {
      console.log("Hämtade avgångar från station:", data.departures[0].stop_area.name);
    }

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
    
    res.status(200).json({ departures: trains });
  } catch (err) {
    console.error("Fel vid hämtning av SL-data:", err);
    res.status(500).json({ error: "Kunde inte hämta avgångsinformation" });
  }
};

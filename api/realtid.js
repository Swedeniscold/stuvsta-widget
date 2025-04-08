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
};

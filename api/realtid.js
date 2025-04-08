// api/realtid.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    const siteId = 9303; // Stuvsta
    const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures`;
    
    console.log("Anropar Transport API:", url);
    
    const response = await fetch(url);
    console.log("API svarstatus:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API svarade med fel:", response.status, errorText);
      return res.status(response.status).json({ 
        error: "Fel vid anrop till SL API", 
        status: response.status, 
        details: errorText 
      });
    }
    
    const data = await response.json();
    console.log("API-svar mottaget, antal avgångar:", data.departures ? data.departures.length : 0);

    if (!data || !data.departures) {
      console.log("Ingen avgångsdata hittades i svaret:", JSON.stringify(data));
      return res.status(404).json({ error: "Inga avgångar hittades i API-svaret" });
    }

    // Filtrera norrgående pendeltåg
    const destinations = ["Stockholm City", "Odenplan", "Uppsala", "Märsta"];
    const trains = data.departures
      .filter(dep => dep.transportMode === "TRAIN" && destinations.includes(dep.destination))
      .map(dep => ({
        line: dep.lineNumber,
        destination: dep.destination,
        displayTime: dep.displayTime
      }));
    
    console.log("Filtrerade fram", trains.length, "norrgående tåg");
    
    // Ställ in CORS-headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.status(200).json({ departures: trains });
  } catch (err) {
    console.error("Fel vid hämtning av SL-data:", err);
    res.status(500).json({ error: "Kunde inte hämta avgångsinformation", details: err.message });
  }
};

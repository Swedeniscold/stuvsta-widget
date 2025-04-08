// api/realtid.js
const fetch = require('node-fetch');


module.exports = async (req, res) => {
  const siteId = 9303; // Stuvsta
  const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.departures) {
      console.log("Ingen data från SL Transport");
      return res.status(500).json({ error: "Ingen avgångsinformation hittades" });
    }

    // Filtrera norrgående pendeltåg (mot Stockholm City, Märsta, etc)
    const destinations = ["Stockholm City", "Odenplan", "Uppsala", "Märsta"];
    const trains = data.departures
      .filter(dep => dep.transportMode === "TRAIN" && destinations.includes(dep.destination))
      .map(dep => ({
        line: dep.lineNumber,
        destination: dep.destination,
        displayTime: dep.displayTime
      }));

    res.status(200).json({ departures: trains });
  } catch (err) {
    console.error("Fel vid hämtning av SL-data:", err);
    res.status(500).json({ error: "Kunde inte hämta avgångsinformation" });
  }
};

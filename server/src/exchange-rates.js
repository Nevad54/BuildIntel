const ECB_DAILY_RATES_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const AED_PER_USD = 3.6725;

let cache = null;

export const parseRatesXml = (xml) => {
  const dateMatch = xml.match(/time=['"]([^'"]+)['"]/i);
  const date = dateMatch?.[1] || new Date().toISOString().slice(0, 10);
  const rates = { EUR: 1 };

  for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    rates[match[1]] = Number(match[2]);
  }

  if (rates.USD && !rates.AED) {
    rates.AED = rates.USD * AED_PER_USD;
  }

  return {
    base: "EUR",
    date,
    rates
  };
};

export const resetExchangeRatesCache = () => {
  cache = null;
};

export const getExchangeRates = async () => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.payload;
  }

  const response = await fetch(ECB_DAILY_RATES_URL);
  if (!response.ok) {
    throw new Error(`Unable to load exchange rates: ${response.status}`);
  }

  const xml = await response.text();
  const payload = parseRatesXml(xml);
  cache = {
    fetchedAt: Date.now(),
    payload
  };

  return payload;
};

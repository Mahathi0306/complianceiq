export const RISK_CONFIG = Object.freeze({
  highRiskCountries: ['IR', 'KP', 'SY', 'MM', 'AF', 'YE'],
  elevatedCountries: ['PK', 'NG', 'PA', 'VG', 'AE'],
  highRiskOccupations: ['jeweller', 'casino', 'money changer', 'crypto', 'cash intensive', 'real estate broker'],
  mediumRiskOccupations: ['trader', 'business owner', 'consultant', 'freelancer', 'agent'],
  points: {
    highRiskCountry: 30,
    elevatedCountry: 15,
    highRiskOccupation: 20,
    mediumRiskOccupation: 10,
    pep: 25,
    volumeStrong: 20,
    volumeModerate: 10,
    screeningStrong: 40,
    screeningLikely: 20,
    screeningPossible: 10,
  },
  thresholds: { medium: 35, high: 65 },
});

function containsAny(text, keywords) {
  const value = text.toLowerCase();
  return keywords.some((keyword) => value.includes(keyword));
}

export function computeRisk(customer, { screeningScore = 0, config = RISK_CONFIG } = {}) {
  const breakdown = [];
  const add = (factor, points, detail) => {
    if (points > 0) breakdown.push({ factor, points, detail });
  };
  const { points } = config;

  const country = String(customer.country || '').toUpperCase();
  if (config.highRiskCountries.includes(country)) {
    add('COUNTRY', points.highRiskCountry, `Resident country ${country} is classed as high risk`);
  } else if (config.elevatedCountries.includes(country)) {
    add('COUNTRY', points.elevatedCountry, `Resident country ${country} needs enhanced attention`);
  }

  const occupation = String(customer.occupation || '');
  if (containsAny(occupation, config.highRiskOccupations)) {
    add('OCCUPATION', points.highRiskOccupation, `Occupation "${occupation}" is cash intensive or high risk`);
  } else if (containsAny(occupation, config.mediumRiskOccupations)) {
    add('OCCUPATION', points.mediumRiskOccupation, `Occupation "${occupation}" has variable income patterns`);
  }

  if (customer.isPep) add('PEP', points.pep, 'Customer is a politically exposed person');

  const annualExpected = (customer.expectedMonthlyVolume || 0) * 12;
  const ratio = annualExpected / Math.max(customer.annualIncome || 0, 1);
  if (ratio > 3) {
    add('VOLUME_MISMATCH', points.volumeStrong, `Expected yearly turnover is ${ratio.toFixed(1)}x declared income`);
  } else if (ratio > 1.5) {
    add('VOLUME_MISMATCH', points.volumeModerate, `Expected yearly turnover is ${ratio.toFixed(1)}x declared income`);
  }

  if (screeningScore >= 0.92) {
    add('WATCHLIST', points.screeningStrong, `Name matches a watchlist entry at ${Math.round(screeningScore * 100)}%`);
  } else if (screeningScore >= 0.85) {
    add('WATCHLIST', points.screeningLikely, `Name resembles a watchlist entry at ${Math.round(screeningScore * 100)}%`);
  } else if (screeningScore >= 0.78) {
    add('WATCHLIST', points.screeningPossible, `Name loosely resembles a watchlist entry at ${Math.round(screeningScore * 100)}%`);
  }

  const score = Math.min(100, breakdown.reduce((sum, item) => sum + item.points, 0));
  let level = 'LOW';
  if (score >= config.thresholds.high) level = 'HIGH';
  else if (score >= config.thresholds.medium) level = 'MEDIUM';
  return { score, level, breakdown };
}

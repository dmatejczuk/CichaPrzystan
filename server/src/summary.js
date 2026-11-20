// MOCK DATA for use only in testing in full build change to real data.

export async function getStaySummary(id) {
  return {
    id,
    summary: 'MOCK: quiet place far from any cell tower. Replace with real summarisation.',
    rating: { average: 4.6, count: 12 },
    opinions: [
      { author: 'Anna', rating: 5, text: 'MOCK: Totally quiet, great stars at night.', source: 'mock' },
      { author: 'Piotr', rating: 4, text: 'MOCK: No signal at all, bring a paper map.', source: 'mock' },
    ],
    activities: ['hiking', 'stargazing', 'mushroom picking'],
    generatedAt: new Date().toISOString(),
  }
}

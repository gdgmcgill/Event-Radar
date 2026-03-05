import {
  jaccardSimilarity,
  rerankWithMMR,
  RecommendationItem,
  DiversityMetadata,
} from './diversity';

// ── jaccardSimilarity ───────────────────────────────────────────────────────

describe('jaccardSimilarity', () => {
  it('returns 1 for identical sets', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('returns 0 for completely disjoint sets', () => {
    expect(jaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('computes correct value for partial overlap', () => {
    // intersection = {b}, union = {a,b,c} => 1/3
    expect(jaccardSimilarity(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3);
  });

  it('returns 0 when both sets are empty', () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  it('returns 0 when one set is empty', () => {
    expect(jaccardSimilarity(['a'], [])).toBe(0);
    expect(jaccardSimilarity([], ['a'])).toBe(0);
  });
});

// ── rerankWithMMR ───────────────────────────────────────────────────────────

const sampleItems: RecommendationItem[] = [
  {
    event_id: '1',
    score: 0.9,
    tags: ['academic', 'career'],
    title: 'Career Fair',
    description: '',
    hosting_club: null,
    category: null,
  },
  {
    event_id: '2',
    score: 0.85,
    tags: ['academic', 'career'],
    title: 'Resume Workshop',
    description: '',
    hosting_club: null,
    category: null,
  },
  {
    event_id: '3',
    score: 0.8,
    tags: ['social', 'cultural'],
    title: 'Culture Night',
    description: '',
    hosting_club: null,
    category: null,
  },
  {
    event_id: '4',
    score: 0.7,
    tags: ['sports', 'wellness'],
    title: 'Yoga Session',
    description: '',
    hosting_club: null,
    category: null,
  },
];

describe('rerankWithMMR', () => {
  it('with lambda=1 preserves original relevance order', () => {
    const { items } = rerankWithMMR(sampleItems, 1.0);
    const ids = items.map((i) => i.event_id);
    expect(ids).toEqual(['1', '2', '3', '4']);
  });

  it('with lambda=0 pushes similar items apart', () => {
    const { items } = rerankWithMMR(sampleItems, 0.0);
    const ids = items.map((i) => i.event_id);
    // First item is still the highest-scored, but the second should NOT be '2'
    // because '2' has identical tags to '1' and lambda=0 means pure diversity
    expect(ids[0]).toBe('1');
    expect(ids[1]).not.toBe('2');
  });

  it('returns all items', () => {
    const { items } = rerankWithMMR(sampleItems);
    expect(items).toHaveLength(sampleItems.length);
  });

  it('metadata has correct fields and types', () => {
    const { metadata } = rerankWithMMR(sampleItems);
    expect(typeof metadata.lambda).toBe('number');
    expect(typeof metadata.avg_pairwise_distance).toBe('number');
    expect(metadata.avg_pairwise_distance).toBeGreaterThanOrEqual(0);
    expect(metadata.avg_pairwise_distance).toBeLessThanOrEqual(1);
    expect(typeof metadata.tag_distribution).toBe('object');
  });

  it('handles empty input', () => {
    const { items, metadata } = rerankWithMMR([]);
    expect(items).toHaveLength(0);
    expect(metadata.avg_pairwise_distance).toBe(0);
    expect(metadata.tag_distribution).toEqual({});
  });

  it('handles single item', () => {
    const single: RecommendationItem[] = [
      {
        event_id: '1',
        score: 0.5,
        tags: ['academic'],
        title: 'Test',
        description: '',
        hosting_club: null,
        category: null,
      },
    ];
    const { items, metadata } = rerankWithMMR(single);
    expect(items).toHaveLength(1);
    expect(metadata.avg_pairwise_distance).toBe(0);
  });

  it('tag distribution counts are correct', () => {
    const { metadata } = rerankWithMMR(sampleItems);
    // Each tag appears once per item: academic(2), career(2), social(1), cultural(1), sports(1), wellness(1)
    expect(metadata.tag_distribution['academic']).toBe(2);
    expect(metadata.tag_distribution['career']).toBe(2);
    expect(metadata.tag_distribution['social']).toBe(1);
    expect(metadata.tag_distribution['cultural']).toBe(1);
    expect(metadata.tag_distribution['sports']).toBe(1);
    expect(metadata.tag_distribution['wellness']).toBe(1);
  });
});

// One place to keep the little icon shown next to each category, so the
// home page filter buttons and the category dropdowns (post/edit listing)
// always match. Keyed by the category's slug (not its display name), so
// renaming a category later (e.g. Produce -> Vegetable) doesn't break its icon.

const CATEGORY_ICONS = {
  produce: '🥬',
  seafood: '🐟',
  'meat-poultry': '🍗',
  'home-goods': '🏠',
  electronics: '📱',
  clothing: '👕',
  other: '📦',
  'resorts-venues': '🏖️',
  motors: '🏍️',
  'food-snacks': '🍢',
};

const FALLBACK_ICON = '🏷️';

export function getCategoryIcon(slug) {
  return CATEGORY_ICONS[slug] || FALLBACK_ICON;
}

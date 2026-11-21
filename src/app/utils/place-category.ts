/**
 * A trip-place category (stay | food | activity) from Google place types,
 * for places found by search, which don't come from a Stay / Eat / Do list.
 * Same rules as the app.
 */
export function tripCategoryFromTypes(types: string[] | null | undefined): 'stay' | 'food' | 'activity' {
  const t = types || [];
  const has = (...names: string[]) => names.some((n) => t.includes(n));
  if (has('lodging', 'campground', 'rv_park')) return 'stay';
  if (has('restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_takeaway', 'meal_delivery', 'night_club')) return 'food';
  return 'activity';
}

/** The favourites category for the same place (lodging | restaurant | tourist_attraction). */
export function favouriteCategoryFromTypes(types: string[] | null | undefined): 'lodging' | 'restaurant' | 'tourist_attraction' {
  const c = tripCategoryFromTypes(types);
  return c === 'stay' ? 'lodging' : c === 'food' ? 'restaurant' : 'tourist_attraction';
}

export type MealIngredient = {
  id: number;
  position: number;
  raw_line: string;
  amount: string;
  unit: string;
  name: string;
  ingredient_id?: number | null;
};

export type MealCategoryBrief = {
  id: number;
  name: string;
  axis: "meal_type" | "cuisine" | "time";
};

export type Meal = {
  id: number;
  owner_user: number;
  title: string;
  blurb: string;
  directions: string;
  ingredients: MealIngredient[];
  cloned_from_meal: number | null;
  /** Set when the meal was created from or linked to a recipe URL. */
  source_url?: string;
  /** R2 object key for recipe photo (same bucket as Closet). */
  image_key?: string;
  /** Presigned R2 read URL when `image_key` is present. */
  image_url?: string;
  is_published_to_friends?: boolean;
  tag_names?: string[];
  meal_type?: MealCategoryBrief | null;
  cuisine?: MealCategoryBrief | null;
  time?: MealCategoryBrief | null;
  upcoming_slot_count?: number;
  past_slot_count?: number;
  pantry_coverage_pct?: number | null;
  can_publish?: boolean;
  /** Friend-published browse (detail/list); not set on meals you own. */
  author_display?: string;
  created_at: string;
  updated_at: string;
};

/** Friend-published meal in Shared Meals browse (API adds `author_display`). */
export type SharedMeal = Meal & {
  author_display?: string;
};

/** Body for creating a meal (aligned with `createMeal` API). */
export type MealCreateInput = {
  title: string;
  blurb?: string;
  directions?: string;
  ingredients?: { raw_line: string; amount?: string; unit?: string; name?: string }[];
};

export type InstanceSlot = {
  day_index: number;
  slot_index: number;
  meal_ids: number[];
};

export type MealPlanInstance = {
  id: number;
  owner_user: number;
  week_start: string;
  slots: InstanceSlot[];
  created_at: string;
  updated_at: string;
};

export type GroceryContribution = {
  meal_id: number | null;
  meal_title: string;
  display: string;
  quantity?: string;
  unit?: string;
  /** Echo of meal line fields for merged rows (optional). */
  raw_line?: string;
  name?: string;
};

export type GroceryListItem = {
  id: number;
  position: number;
  display_text: string;
  quantity: string;
  unit: string;
  source_meal: number | null;
  manually_added: boolean;
  ingredient_id: number | null;
  is_checked: boolean;
  contributions: GroceryContribution[];
};

export type GroceryList = {
  id: number;
  owner_user: number;
  instance: number;
  items: GroceryListItem[];
  hide_checked?: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedGroceryList = {
  id: number;
  label: string;
  source_instance: number | null;
  snapshot: { items: unknown[]; source_grocery_list_id?: number };
  saved_at: string;
};

export type PantryTags = {
  food_group: string[];
  storage: string[];
  preferred_meal: string[];
  dietary: string[];
};

export type IngredientBrief = {
  id: number;
  name: string;
  food_group?: string;
  /** User override; empty uses category default or basket placeholder. */
  display_emoji?: string;
  created_at: string;
};

export type PantryInventoryRow = {
  id: number;
  ingredient: IngredientBrief;
  quantity: number;
  simple_have: boolean | null;
  location: string;
  pantry_tags?: PantryTags;
  owner_user_id?: number;
  /** Partner display name when row belongs to meal partner; empty for own rows. */
  owner_label?: string;
  /** Set when pantry tracking is on: in-stock item not on this week's plan or unused in library. */
  pantry_recommendation_hint?: "not_scheduled" | "no_recipes" | null;
};

export type ParsedPantryItem = {
  raw_line: string;
  location: string;
  name: string;
  quantity: number;
  skipped: boolean;
  is_section_header: boolean;
};

export type PantryParseResponse = {
  items: ParsedPantryItem[];
};

export type PantryImportResponse = {
  imported: number;
  items: PantryInventoryRow[];
};

export type DisconnectPending = {
  id: number;
  status: string;
  initiator_id: number;
  recipient_id: number;
  i_am_initiator: boolean;
} | null;

export type MealCategoryOptionsByAxis = {
  meal_type: MealCategoryBrief[];
  cuisine: MealCategoryBrief[];
  time: MealCategoryBrief[];
};

export type MealBootstrapResponse = {
  meals: Meal[];
  shared_meals: SharedMeal[];
  instances: MealPlanInstance[];
  category_options: MealCategoryOptionsByAxis;
  tags: string[];
  pantry_inventory: PantryInventoryRow[] | null;
  disconnect_pending: DisconnectPending;
};

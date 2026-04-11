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
  /** Public URL when `CLOSET_R2_PUBLIC_BASE_URL` is set and `image_key` is present. */
  image_url?: string;
  is_published_to_friends?: boolean;
  tag_names?: string[];
  meal_type?: MealCategoryBrief | null;
  cuisine?: MealCategoryBrief | null;
  time?: MealCategoryBrief | null;
  upcoming_slot_count?: number;
  can_publish?: boolean;
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

export type TemplateSlot = {
  day_index: number;
  slot_index: number;
  meal_ids: number[];
};

export type MealPlanTemplate = {
  id: number;
  owner_user: number;
  name: string;
  description: string;
  slots_per_day: number;
  slots: TemplateSlot[];
  created_at: string;
  updated_at: string;
};

export type InstanceSlot = {
  day_index: number;
  slot_index: number;
  meal_ids: number[];
};

export type MealPlanInstance = {
  id: number;
  owner_user: number;
  source_template: number | null;
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

export type PantryInventoryRow = {
  id: number;
  ingredient: { id: number; name: string };
  quantity: number;
  simple_have: boolean | null;
};

export type PantryHint = {
  ingredient_id: number;
  ingredient_name: string;
  recommended_meals: { id: number; title: string }[];
};

export type PantrySuggestionsResponse = {
  enabled: boolean;
  week_start?: string;
  hints: PantryHint[];
};

export type DisconnectPending = {
  id: number;
  status: string;
  initiator_id: number;
  recipient_id: number;
  i_am_initiator: boolean;
} | null;

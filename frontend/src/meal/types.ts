export type MealIngredient = {
  id: number;
  position: number;
  raw_line: string;
  amount: string;
  unit: string;
  name: string;
};

export type Meal = {
  id: number;
  owner_user: number;
  title: string;
  blurb: string;
  directions: string;
  ingredients: MealIngredient[];
  cloned_from_meal: number | null;
  created_at: string;
  updated_at: string;
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

export type GroceryListItem = {
  id: number;
  position: number;
  display_text: string;
  quantity: string;
  unit: string;
  source_meal: number | null;
  manually_added: boolean;
};

export type GroceryList = {
  id: number;
  owner_user: number;
  instance: number;
  items: GroceryListItem[];
  created_at: string;
  updated_at: string;
};

export type DisconnectPending = {
  id: number;
  status: string;
  initiator_id: number;
  recipient_id: number;
  i_am_initiator: boolean;
} | null;

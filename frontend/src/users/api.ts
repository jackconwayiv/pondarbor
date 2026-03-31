export type UpcomingBirthday = {
  display_name: string;
  birth_month: number;
  birth_day: number;
};

export async function fetchUpcomingBirthdays(
  accessToken: string,
): Promise<UpcomingBirthday[]> {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  const response = await fetch(`${base}/api/v1/users/upcoming-birthdays/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`Upcoming birthdays fetch failed: ${response.status}`);
  }

  return (await response.json()) as UpcomingBirthday[];
}

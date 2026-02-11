const BASE_URL = process.env.SECONDME_API_BASE_URL!;

export async function fetchSecondMe(path: string, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || "SecondMe API error");
  return json.data;
}

export async function getUserInfo(token: string) {
  return fetchSecondMe("/api/secondme/user/info", token);
}

export async function getUserShades(token: string) {
  const data = await fetchSecondMe("/api/secondme/user/shades", token);
  return data.shades;
}

export async function getUserSoftMemory(token: string) {
  const data = await fetchSecondMe("/api/secondme/user/softmemory", token);
  return data.list;
}

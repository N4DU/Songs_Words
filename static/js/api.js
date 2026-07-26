// Client for the local server's JSON API.

async function asJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

export const getSongs = () => fetch('/api/songs').then(asJson);
export const getSong = (id) => fetch(`/api/songs/${id}`).then(asJson);
export const deleteSong = (id) => fetch(`/api/songs/${id}`, { method: 'DELETE' }).then(asJson);

export const createSong = (formData) =>
  fetch('/api/songs', { method: 'POST', body: formData }).then(asJson);

export const updateSong = (id, formData) =>
  fetch(`/api/songs/${id}`, { method: 'PUT', body: formData }).then(asJson);

export const setSelected = (id, selected) =>
  fetch(`/api/songs/${id}/selected`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selected }),
  }).then(asJson);

export const getPractice = (ids) =>
  fetch('/api/practice' + (ids && ids.length ? `?ids=${ids.join(',')}` : '')).then(asJson);

export const getSettings = () => fetch('/api/settings').then(asJson);

export const saveSettings = (settings) =>
  fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  }).then(asJson);

export const hello = () =>
  fetch('/api/hello', { method: 'POST' }).catch(() => {});

export const shutdown = () =>
  fetch('/api/shutdown', { method: 'POST' }).catch(() => {});

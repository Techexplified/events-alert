// TODO: replace with a real POST to the backend, which will store the alert
// and schedule the checks.
export async function createAlert(payload) {
  console.log('createAlert payload:', payload);
  await new Promise((r) => setTimeout(r, 600));
  return { id: 'local-' + Date.now() };
}

// TODO: replace these stubs with real backend calls.
export async function updateAlert(id, payload) {
  console.log('updateAlert', id, payload);
  await new Promise((r) => setTimeout(r, 600));
  return { id };
}

export async function deleteAlert(id) {
  console.log('deleteAlert', id);
  await new Promise((r) => setTimeout(r, 600));
  return { id };
}

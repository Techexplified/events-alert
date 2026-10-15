// TODO: replace with a real POST to the backend, which will store the alert
// and schedule the checks.
export async function createAlert(payload) {
  console.log('createAlert payload:', payload);
  await new Promise((r) => setTimeout(r, 600));
  return { id: 'local-' + Date.now() };
}

export const frequencyOptions = [
  { value: 'immediate', label: 'Immediately when the condition is met' },
  { value: 'daily', label: 'Once a day (daily digest)' },
  { value: 'weekly', label: 'Once a week (weekly digest)' }
];

export function getFrequencyLabel(value) {
  const found = frequencyOptions.find((opt) => opt.value === value);
  return found ? found.label : (value || 'Immediately when the condition is met');
}

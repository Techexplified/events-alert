export const steps = [
  { step: 1, label: 'Alert Type' },
  { step: 2, label: 'Conditions' },
  { step: 3, label: 'Recipients' },
  { step: 4, label: 'Review' }
];

/**
 * Renders the 4-step wizard stepper component into a target container.
 * @param {HTMLElement|string} container - The DOM element or selector to render into.
 * @param {number} currentStep - The active step index (1-4).
 */
export function renderStepper(container, currentStep = 1) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  const totalSteps = steps.length;
  const progressRatio = totalSteps > 1 ? (currentStep - 1) / (totalSteps - 1) : 0;

  const html = `
    <div class="stepper-wrapper">
      <div class="stepper-line-bg"></div>
      <div class="stepper-line-progress" style="width: calc((100% - 72px) * ${progressRatio});"></div>
      <div class="stepper-steps">
        ${steps
          .map((item) => {
            const isActive = item.step === currentStep;
            const isCompleted = item.step < currentStep;
            const stepClass = isActive ? 'active' : isCompleted ? 'completed' : 'inactive';

            const circleContent = isCompleted
              ? `<svg class="step-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`
              : item.step;

            return `
              <div class="step-item ${stepClass}">
                <div class="step-circle">${circleContent}</div>
                <div class="step-label">${item.label}</div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  el.innerHTML = html;
}

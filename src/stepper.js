export const steps = [
  { step: 1, label: 'Alert Details' },
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

  const html = `
    <div class="stepper-wrapper">
      <div class="stepper-line-bg"></div>
      <div class="stepper-steps">
        ${steps
          .map((item) => {
            const isActive = item.step === currentStep;
            const isCompleted = item.step < currentStep;
            const stepClass = isActive ? 'active' : isCompleted ? 'completed' : 'inactive';

            return `
              <div class="step-item ${stepClass}">
                <div class="step-circle">${item.step}</div>
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

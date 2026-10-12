export const alertTypes = [
  {
    id: 'card-stuck',
    icon: '⏰',
    iconBg: '#FEE2E2',
    iconColor: '#EF4444',
    title: 'Card is stuck in a list',
    description: 'Notify when a card stays in the same list for too long.'
  },
  {
    id: 'no-activity',
    icon: '⚡',
    iconBg: '#FEF3C7',
    iconColor: '#F59E0B',
    title: 'No activity on a card',
    description: 'Notify when a card hasn’t been updated for a set number of days.'
  },
  {
    id: 'overdue-in-list',
    icon: '📅',
    iconBg: '#EEF2FF',
    iconColor: '#4F46E5',
    title: 'Overdue and in a list',
    description: 'Notify when a card is overdue and still in a specific list.'
  },
  {
    id: 'due-soon-unassigned',
    icon: '👤',
    iconBg: '#E0F2FE',
    iconColor: '#0284C7',
    title: 'Due soon and unassigned',
    description: 'Notify when a card is due soon and has no assignee.'
  },
  {
    id: 'custom-condition',
    icon: '⚙️',
    iconBg: '#DCFCE7',
    iconColor: '#0F172A',
    title: 'Custom condition',
    description: 'Create your own condition.'
  }
];

// Helper to render crisp SVG icons for each alert type
export function getIconSvg(typeId, color) {
  switch (typeId) {
    case 'card-stuck':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <polyline points="12 7.5 12 12 8 12"/>
      </svg>`;
    case 'no-activity':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="2.5 12 6.5 12 9.5 6.5 13.5 17.5 16.5 9.5 18.5 12 21.5 12"/>
      </svg>`;
    case 'overdue-in-list':
    case 'due-date':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="17" x="3" y="4" rx="2.5"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
        <rect x="14" y="14" width="2.2" height="2.2" rx="0.5" fill="${color}" stroke="${color}"/>
      </svg>`;
    case 'due-soon-unassigned':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M19 20.5v-1.5a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1.5"/>
      </svg>`;
    case 'custom-condition':
    case 'custom-fields':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="5.5" y2="6"/>
        <line x1="10.5" y1="6" x2="21" y2="6"/>
        <circle cx="8" cy="6" r="2.5"/>
        <line x1="3" y1="12" x2="13.5" y2="12"/>
        <line x1="18.5" y1="12" x2="21" y2="12"/>
        <circle cx="16" cy="12" r="2.5"/>
        <line x1="3" y1="18" x2="5.5" y2="18"/>
        <line x1="10.5" y1="18" x2="21" y2="18"/>
        <circle cx="8" cy="18" r="2.5"/>
      </svg>`;
    default:
      return '';
  }
}

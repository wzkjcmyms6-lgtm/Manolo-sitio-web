// Set de iconos en línea (SVG) usado en toda la navegación, tarjetas y controles.
const ICON_ATTRS = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  home: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1v-9"/></svg>`,

  habits: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.4 2.4 5.2-5.2"/></svg>`,

  exercise: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="2" y="9.5" width="2.6" height="5" rx="1"/><rect x="6" y="7.5" width="3" height="9" rx="1.2"/><path d="M9 12h6"/><rect x="15" y="7.5" width="3" height="9" rx="1.2"/><rect x="19.4" y="9.5" width="2.6" height="5" rx="1"/></svg>`,

  finance: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="3" y="6.5" width="18" height="12" rx="2.2"/><path d="M3 10h18"/><path d="M15.5 14.5h2.5"/></svg>`,

  investing: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M3 16.5 9 10l4 4 7-8"/><path d="M15 5.5h5v5"/></svg>`,

  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,

  trash: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6.5 7l0.9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M10 11v6M14 11v6"/></svg>`,

  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,

  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,

  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,

  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,

  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,

  // Categorías de Finanzas
  food: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M7 2v8a2 2 0 0 0 4 0V2"/><path d="M9 10v12"/><path d="M17 2c-1.5 1-2 3-2 5s1.5 3 2 3v12"/></svg>`,

  transport: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="4" y="5" width="16" height="10" rx="3"/><path d="M4 10h16"/><path d="M7 15v2M17 15v2"/></svg>`,

  health: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 20s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 5c-2.3 4.5-9.3 9-9.3 9Z"/></svg>`,

  entertainment: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9l5 3-5 3V9Z"/></svg>`,

  shopping: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,

  subscription: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 12a8 8 0 0 1 13.5-5.7M20 12a8 8 0 0 1-13.5 5.7"/><path d="M17 3v4h-4M7 21v-4h4"/></svg>`,

  otherCategory: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>`,

  salary: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/></svg>`
};

function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(el => {
    const svg = ICONS[el.dataset.icon];
    if (svg) el.innerHTML = svg;
  });
}

document.addEventListener("DOMContentLoaded", () => renderIcons());

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

  running: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="14.2" cy="4.6" r="1.6"/><path d="M9 21l2-4.5-1.3-2.3 3-2.3"/><path d="M12.7 12l-1-3.3 3-1.6 2.3 2.4 3-1"/><path d="M7.5 12.3l3.2-2.3"/><path d="M13.5 15l3 1.7 2-2.4"/></svg>`,

  cycling: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="6" cy="17" r="3.3"/><circle cx="18" cy="17" r="3.3"/><path d="M6 17l5-8h3l4 8"/><path d="M11 9h3"/><path d="M9.5 17h5.5"/></svg>`,

  eye: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,

  tools: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.7 2.7-2-2Z"/></svg>`,

  // Variantes "rellenas" para el estado activo de la barra inferior de
  // Finanzas (Vista general/Presupuesto/Herramientas), inspiradas en Buddy.
  eyeFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/></svg>`,
  budgetFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="9"/></svg>`,
  toolsFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.7 2.7-2-2Z"/></svg>`,

  // Categorías de Finanzas
  food: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M7 2v8a2 2 0 0 0 4 0V2"/><path d="M9 10v12"/><path d="M17 2c-1.5 1-2 3-2 5s1.5 3 2 3v12"/></svg>`,

  transport: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="4" y="5" width="16" height="10" rx="3"/><path d="M4 10h16"/><path d="M7 15v2M17 15v2"/></svg>`,

  health: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 20s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 5c-2.3 4.5-9.3 9-9.3 9Z"/></svg>`,

  entertainment: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9l5 3-5 3V9Z"/></svg>`,

  shopping: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,

  subscription: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 12a8 8 0 0 1 13.5-5.7M20 12a8 8 0 0 1-13.5 5.7"/><path d="M17 3v4h-4M7 21v-4h4"/></svg>`,

  otherCategory: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>`,

  salary: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/></svg>`,

  // Herramientas de Finanzas
  wallet: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2H5a2 2 0 0 0 0 4h14v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><circle cx="17" cy="13" r="1.1" fill="currentColor" stroke="none"/></svg>`,
  search: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 4l16 16"/><path d="M9.9 5.7A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17.6 17.6 0 0 1-3.2 3.9M6.6 7.3A17.4 17.4 0 0 0 2 12s3.6 6.5 10 6.5a9.6 9.6 0 0 0 4.2-.9"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M20 12.7 12.7 20a1.5 1.5 0 0 1-2.1 0L3 12.4V5a2 2 0 0 1 2-2h7.4a1.5 1.5 0 0 1 1.1.4l6.9 6.9a1.5 1.5 0 0 1 0 2.1Z"/><circle cx="8" cy="8" r="1.3"/></svg>`,
  download: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M4 18h16"/></svg>`,
  transfer: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M3 8h14"/><path d="M13 4l4 4-4 4"/><path d="M21 16H7"/><path d="M11 12l-4 4 4 4"/></svg>`,

  // Repertorio genérico para elegir ícono al crear una subcategoría.
  drink: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 4h16l-7 8v7h4"/><path d="M9 19h6"/></svg>`,
  pet: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><circle cx="7" cy="8" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="17" cy="8" r="1.6"/><path d="M8 14c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5-1.8 5-4 5-4-3-4-5Z"/></svg>`,
  education: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M2 9l10-4 10 4-10 4-10-4Z"/><path d="M6 11v4c0 1.5 2.5 3 6 3s6-1.5 6-3v-4"/><path d="M22 9v6"/></svg>`,
  gift: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18"/><path d="M12 9v12"/><path d="M12 9c-1.5-3-6-3.5-6-1s3 1 6 1Z"/><path d="M12 9c1.5-3 6-3.5 6-1s-3 1-6 1Z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>`,
  wifi: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 9.5a13 13 0 0 1 16 0"/><path d="M7 13a8.5 8.5 0 0 1 10 0"/><path d="M10 16.5a4 4 0 0 1 4 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none"/></svg>`,
  music: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.3"/></svg>`,
  coffee: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3.5c-.7.7-.7 1.3 0 2M12 3.5c-.7.7-.7 1.3 0 2"/></svg>`,
  fuel: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M4 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16"/><path d="M4 12h9"/><path d="M15 8l3 3v6.5a1.5 1.5 0 0 0 3 0V9c0-1-.5-1.7-1.3-2.3L17 4.5"/><path d="M2 21h15"/></svg>`,
  bank: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M3 10l9-5 9 5"/><path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9"/><path d="M3 19h18"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>`,
  water: `<svg viewBox="0 0 24 24" ${ICON_ATTRS}><path d="M12 3s6 7 6 11.5a6 6 0 0 1-12 0C6 10 12 3 12 3Z"/></svg>`
};

function renderIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(el => {
    const svg = ICONS[el.dataset.icon];
    if (svg) el.innerHTML = svg;
  });
}

document.addEventListener("DOMContentLoaded", () => renderIcons());

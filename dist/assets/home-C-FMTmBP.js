import"./modulepreload-polyfill-B5Qt9EMX.js";const i=typeof window.TrelloPowerUp<"u"?window.TrelloPowerUp.iframe():null,o=[{id:"due-date",icon:"📅",iconBg:"#DBEAFE",iconColor:"#2563EB",title:"Due date reminder",description:"Get notified before a card's due date."},{id:"card-moves",icon:"↔️",iconBg:"#D1FAE5",iconColor:"#059669",title:"Card moves",description:"Get notified when a card is moved."},{id:"mentions",icon:"@",iconBg:"#FFEDD5",iconColor:"#D97706",title:"Mentions",description:"Get notified when you are mentioned."},{id:"comments",icon:"💬",iconBg:"#EDE9FE",iconColor:"#7C3AED",title:"Comments",description:"Get notified when a new comment is added."},{id:"custom-fields",icon:"🎚️",iconBg:"#CCFBF1",iconColor:"#0D9488",title:"Custom field changes",description:"Get notified when a custom field is updated."}];function r(t,e){switch(t){case"due-date":return`<svg viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>`;case"card-moves":return`<svg viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 7H20M20 7L16 3M20 7L16 11M16 17H4M4 17L8 13M4 17L8 21"/>
      </svg>`;case"mentions":return`<svg viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>
      </svg>`;case"comments":return`<svg viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
      </svg>`;case"custom-fields":return`<svg viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="4" x2="20" y1="21" y2="21"/>
        <line x1="4" x2="20" y1="14" y2="14"/>
        <line x1="4" x2="20" y1="7" y2="7"/>
        <circle cx="9" cy="7" r="2" fill="${e}"/>
        <circle cx="15" cy="14" r="2" fill="${e}"/>
        <circle cx="10" cy="21" r="2" fill="${e}"/>
      </svg>`;default:return""}}function c(){const t=document.getElementById("alert-cards-container");t&&(t.innerHTML=o.map(e=>`
    <div class="alert-card" data-alert-id="${e.id}">
      <div class="alert-icon-wrapper" style="background-color: ${e.iconBg};">
        ${r(e.id,e.iconColor)}
      </div>
      <div class="alert-info">
        <h3 class="alert-title">${e.title}</h3>
        <p class="alert-description">${e.description}</p>
      </div>
      <div class="alert-chevron">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    </div>
  `).join(""),t.querySelectorAll(".alert-card").forEach(e=>{e.addEventListener("click",()=>{const n=e.getAttribute("data-alert-id");console.log("alert type selected:",n)})}))}function l(){const t=document.querySelectorAll(".nav-item");t.forEach(e=>{e.addEventListener("click",()=>{t.forEach(n=>n.classList.remove("active")),e.classList.add("active")})})}function s(){const t=document.getElementById("close-modal-btn");t&&t.addEventListener("click",()=>{i&&typeof i.closeModal=="function"?i.closeModal():console.log("Modal closed (running outside Trello iframe)")})}function d(){const t=document.getElementById("btn-create-alert");t&&t.addEventListener("click",()=>{console.log("create alert clicked")})}document.addEventListener("DOMContentLoaded",()=>{c(),l(),s(),d()});

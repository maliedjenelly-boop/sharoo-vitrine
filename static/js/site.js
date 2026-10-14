// Sharoo Tastemade — interactions légères. Le site reste utilisable sans JavaScript
// pour la navigation ; les montants affichés ici sont indicatifs, le serveur recalcule tout.
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const euros = (c) => {
    const v = c / 100;
    return Number.isInteger(v) ? `${v.toLocaleString('fr-FR')} €` : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dateFr = (iso) => { const [y, m, d] = iso.split('-').map(Number); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${DAYS[wd]} ${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`; };

  document.addEventListener('DOMContentLoaded', () => {
    // Menu mobile
    const toggle = $('.menu-toggle');
    const nav = $('#nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
    }

    // En-tête affiné au défilement
    const header = $(".site-header");
    if (header) {
      const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 12);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    // Apparition discrète au défilement
    const reveals = $$('.reveal');
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
      reveals.forEach((el) => io.observe(el));
    } else reveals.forEach((el) => el.classList.add('in'));

    // Résumé d'erreurs : focus pour les lecteurs d'écran
    const summary = $('#erreurs');
    if (summary) summary.focus();

    // Cases qui affichent / masquent un bloc
    $$('[data-toggle]').forEach((cb) => {
      const target = $(cb.dataset.toggle);
      const sync = () => target && target.classList.toggle('hidden', !cb.checked);
      cb.addEventListener('change', sync);
      sync();
    });

    $$('[data-toggle-off]').forEach((cb) => {
      const target = $(cb.dataset.toggleOff);
      const sync = () => target && target.classList.toggle("hidden", cb.checked);
      cb.addEventListener("change", sync);
      sync();
    });

    // Créneaux disponibles
    const box = $('[data-slots]');
    const dateInput = $('[data-slots-for]');
    async function loadSlots() {
      if (!box || !dateInput || !dateInput.value) return;
      const params = new URLSearchParams({ activite: box.dataset.activity, date: dateInput.value });
      if (box.dataset.formats) params.set('formats', box.dataset.formats);
      if (box.dataset.type) params.set('type', box.dataset.type);
      if (box.dataset.weeks === '4') params.set('semaines', '4');
      box.innerHTML = '<p class="hint">Recherche des créneaux…</p>';
      try {
        const res = await fetch(`/api/creneaux?${params}`, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        renderDates(data.dates);
        if (!data.slots.length) { box.innerHTML = '<p class="hint">Aucun créneau proposé ce jour-là. Essayez une autre date.</p>'; return; }
        const selected = box.dataset.selected;
        box.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'radio-cards';
        data.slots.forEach((s) => {
          const label = document.createElement('label');
          label.className = 'radio-card';
          const input = document.createElement('input');
          input.type = 'radio'; input.name = 'slot_id'; input.value = s.id; input.required = true; input.disabled = !s.available;
          if (String(s.id) === selected && s.available) input.checked = true;
          input.addEventListener('change', () => { box.dataset.selected = s.id; });
          const span = document.createElement('span');
          span.textContent = s.label + (s.available ? '' : ' — indisponible');
          if (!s.available && s.reason) label.title = s.reason;
          label.append(input, span);
          wrap.append(label);
        });
        box.append(wrap);
        const unavailable = data.slots.filter((s) => !s.available && s.reason);
        if (unavailable.length && unavailable.length === data.slots.length) {
          const p = document.createElement('p'); p.className = 'hint mt-s'; p.textContent = unavailable[0].reason; box.append(p);
        }
      } catch {
        box.innerHTML = '<p class="error">Impossible de charger les créneaux. Réessayez.</p>';
      }
    }
    function renderDates(dates) {
      const list = $('[data-dates]');
      if (!list || !dates) return;
      list.innerHTML = '';
      dates.forEach((d, i) => { const li = document.createElement('li'); li.textContent = dates.length > 1 ? `Semaine ${i + 1} : ${dateFr(d)}` : dateFr(d); list.append(li); });
    }
    if (dateInput) { dateInput.addEventListener('change', loadSlots); if (dateInput.value) loadSlots(); }

    // Récapitulatif indicatif (frais de livraison)
    const sum = $('[data-summary]');
    const feeSelect = $('[data-fee-select]');
    const isPickup = () => { const r = $('input[name="fulfillment"]:checked'); return r && r.value === 'pickup'; };
    function updateSummary() {
      if (!sum) return;
      const base = Number(sum.dataset.base || 0);
      const weeks = Number(sum.dataset.weeks || 1);
      const detail = $('[data-fee-detail]', sum);
      const feeCell = $('[data-fee-total]', sum);
      const totalCell = $('[data-grand-total]', sum);
      if (isPickup()) { detail.textContent = 'Retrait : aucun frais'; feeCell.textContent = euros(0); totalCell.textContent = euros(base); return; }
      const opt = feeSelect && feeSelect.selectedOptions[0];
      if (!opt || !opt.dataset.fee) { detail.textContent = 'Choisissez votre arrondissement'; feeCell.textContent = '—'; totalCell.textContent = weeks > 1 ? '—' : euros(base); return; }
      const fee = Number(opt.dataset.fee);
      detail.textContent = weeks > 1 ? `${weeks} livraisons × ${euros(fee)}` : opt.textContent.split(' — ')[0];
      feeCell.textContent = euros(fee * weeks);
      totalCell.textContent = euros(base + fee * weeks);
    }
    if (feeSelect) feeSelect.addEventListener('change', updateSummary);
    updateSummary();

    // Livraison / retrait
    $$('[data-activity-switch]').forEach((r) => r.addEventListener('change', () => {
      const pickup = isPickup();
      $$('[data-delivery-only]').forEach((el) => el.classList.toggle('hidden', pickup));
      if (box) { box.dataset.activity = pickup ? 'pickup' : 'delivery'; loadSlots(); }
      updateSummary();
    }));
    if (isPickup()) $$('[data-delivery-only]').forEach((el) => el.classList.add('hidden'));

    // Contrôle de la taille des fichiers avant envoi
    $$('input[type=file][data-max-mb]').forEach((input) => input.addEventListener('change', () => {
      const f = input.files[0];
      const max = Number(input.dataset.maxMb) * 1024 * 1024;
      input.setCustomValidity('');
      if (f && f.size > max) input.setCustomValidity(`Fichier trop volumineux : ${input.dataset.maxMb} Mo maximum.`);
      else if (f && !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) input.setCustomValidity('Format non accepté : JPEG, PNG ou WebP uniquement.');
    }));

    // Validation côté navigateur avec messages lisibles (le serveur valide toujours)
    $$('form[data-validate]').forEach((form) => form.addEventListener('submit', (e) => {
      $$('.js-error', form).forEach((n) => n.remove());
      const invalid = $$('input, select, textarea', form).filter((el) => !el.disabled && el.willValidate && !el.checkValidity());
      const slotBox = $('[data-slots]', form);
      if (slotBox && !$('input[name="slot_id"]:checked', form)) invalid.push(slotBox);
      if (!invalid.length) { $$('button[type=submit]', form).forEach((b) => { b.disabled = true; b.textContent = 'Envoi en cours…'; }); return; }
      e.preventDefault();
      const seen = new Set();
      invalid.forEach((el) => {
        if (el.type === 'radio') { if (seen.has(el.name)) return; seen.add(el.name); }
        const msg = document.createElement('p');
        msg.className = 'error js-error';
        msg.setAttribute('role', 'alert');
        msg.textContent = el === slotBox ? 'Choisissez un créneau.' : (el.validationMessage || 'Ce champ est à vérifier.');
        const field = el.closest('.field, .check, .radio-cards') || el;
        field.after(msg);
        if (el.setAttribute) el.setAttribute('aria-invalid', 'true');
      });
      const first = invalid[0];
      (first.focus ? first : (first.querySelector('input') || first)).focus();
    }));

    // Retour arrière du navigateur : réactive les boutons d'envoi
    window.addEventListener('pageshow', () => $$('form[data-validate] button[type=submit]').forEach((b) => { if (b.dataset.label) { b.disabled = false; b.textContent = b.dataset.label; } }));
    $$('form[data-validate] button[type=submit]').forEach((b) => { if (!b.disabled) b.dataset.label = b.textContent; });

    // Actualisation automatique (attente du webhook de paiement)
    const auto = $('[data-auto-refresh]');
    if (auto) setTimeout(() => window.location.reload(), Number(auto.dataset.autoRefresh) * 1000);

    // Confirmations pour les actions sensibles (administration)
    $$('form[data-confirm]').forEach((f) => f.addEventListener('submit', (e) => { if (!window.confirm(f.dataset.confirm)) e.preventDefault(); }));
  });
}());

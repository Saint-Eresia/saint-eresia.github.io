const sanitizeHtml = require('sanitize-html');

const cleanText = (value, max = 500) => String(value || '').trim().replace(/[<>]/g, '').slice(0, max);
const cleanChapterHtml = (value) => sanitizeHtml(String(value || ''), {
  allowedTags: ['p', 'br', 'strong', 'em', 'blockquote', 'h2', 'h3', 'hr', 'ul', 'ol', 'li'],
  allowedAttributes: {}, disallowedTagsMode: 'discard'
});
const slugify = (value) => cleanText(value, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cleanInt = (value, min = 0, max = 100) => { const number = Math.round(Number(value)); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null; };
const cleanList = (value, maxItems = 20, max = 300) => (Array.isArray(value) ? value : String(value || '').split('\n'))
  .map((entry) => cleanText(entry, max)).filter(Boolean).slice(0, maxItems);
const cleanDate = (value) => { const text = cleanText(value, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null; };

module.exports = { cleanText, cleanChapterHtml, slugify, cleanInt, cleanList, cleanDate };

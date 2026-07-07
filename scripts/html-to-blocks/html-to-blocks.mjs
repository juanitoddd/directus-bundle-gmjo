#!/usr/bin/env node
/**
 * Convert people_translations.biography (HTML) into the editor.js block JSON
 * consumed by the custom block editor, and store it in people_translations.bio.
 *
 * Unlike the pure-SQL version, this preserves structure and inline formatting
 * by mapping HTML elements onto the exact block/inline tools the editor uses:
 *   <h1>–<h6>          -> header  { text, level }
 *   <p> / loose text   -> paragraph { text }  (keeps <a>/<b>/<strong>/<i>/<em>/<u>)
 *   <ul>/<ol>/<li>     -> nestedlist { style, items:[{content, items}] }
 *   <hr>               -> delimiterblock
 *   <img>              -> imagereference { url, alt }   (URL only — no Directus file id)
 *   <div>/<section>…   -> recursed into
 *
 * Usage:
 *   npm install                      # once, in this folder
 *   PGPASSWORD=... node html-to-blocks.mjs            # DRY RUN (prints, writes nothing)
 *   PGPASSWORD=... node html-to-blocks.mjs --apply    # actually writes bio
 *
 * Connection (env, with defaults):
 *   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=directus PGDATABASE=directus PGPASSWORD=<required>
 *
 * Flags:
 *   --apply        write changes (otherwise dry run)
 *   --overwrite    also fill rows whose bio is already set (default: only bio IS NULL)
 */

import { pathToFileURL } from 'node:url';
import { parse } from 'node-html-parser';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');
const EDITORJS_VERSION = '2.30.7';

// Inline tags we keep inside paragraph/header text (rendered by the editor's
// inline tools / contenteditable). Everything else is unwrapped to its text.
const INLINE_KEEP = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 'br', 'mark', 'code', 'sub', 'sup']);
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const CONTAINERS = new Set(['div', 'section', 'article', 'main', 'body', 'html', 'header', 'footer', 'span']);

const tagOf = (n) => (n.rawTagName ? n.rawTagName.toLowerCase() : '');
const isText = (n) => n.nodeType === 3;
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Serialize a node's children as inline HTML, keeping only INLINE_KEEP tags. */
function inlineHtml(node) {
	let out = '';
	for (const c of node.childNodes) out += serializeInline(c);
	return out.replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function serializeInline(n) {
	if (isText(n)) return n.rawText; // raw text keeps entities (&amp; etc.) HTML-safe
	const tag = tagOf(n);
	if (tag === 'br') return '<br>';
	const inner = n.childNodes.map(serializeInline).join('');
	if (INLINE_KEEP.has(tag)) {
		if (tag === 'a') return `<a href="${escAttr(n.getAttribute('href') || '')}">${inner}</a>`;
		return `<${tag}>${inner}</${tag}>`;
	}
	return inner; // unknown / block-ish tag → unwrap to its inline content
}

const hasBlockChild = (node) =>
	node.childNodes.some((c) => {
		const t = tagOf(c);
		return t && (HEADINGS.has(t) || ['p', 'ul', 'ol', 'hr', 'img', 'blockquote', 'table'].includes(t) || CONTAINERS.has(t));
	});

/** Map an <ul>/<ol> into nestedlist items, recursing into nested lists. */
function listItems(listEl) {
	const items = [];
	for (const li of listEl.childNodes) {
		if (tagOf(li) !== 'li') continue;
		let content = '';
		let children = [];
		for (const c of li.childNodes) {
			const t = tagOf(c);
			if (t === 'ul' || t === 'ol') children = children.concat(listItems(c));
			else content += serializeInline(c);
		}
		items.push({ content: content.replace(/&nbsp;/g, ' ').trim(), items: children });
	}
	return items;
}

/** Walk top-level nodes into editor.js blocks. */
function walkBlocks(nodes, out) {
	for (const n of nodes) {
		if (isText(n)) {
			const t = n.rawText.replace(/&nbsp;/g, ' ').trim();
			if (t) out.push({ type: 'paragraph', data: { text: t } });
			continue;
		}
		const tag = tagOf(n);

		if (HEADINGS.has(tag)) {
			const text = inlineHtml(n);
			if (text) out.push({ type: 'header', data: { text, level: Number(tag[1]) } });
		} else if (tag === 'p' || tag === 'blockquote') {
			const text = inlineHtml(n);
			if (text) out.push({ type: 'paragraph', data: { text } });
		} else if (tag === 'ul' || tag === 'ol') {
			const items = listItems(n);
			if (items.length) out.push({ type: 'nestedlist', data: { style: tag === 'ol' ? 'ordered' : 'unordered', items } });
		} else if (tag === 'hr') {
			out.push({ type: 'delimiterblock', data: {} });
		} else if (tag === 'img') {
			const url = n.getAttribute('src') || '';
			if (url) out.push({ type: 'imagereference', data: { url, alt: n.getAttribute('alt') || '', link: '' } });
		} else if (tag === 'br') {
			// ignore stray line breaks between blocks
		} else if (CONTAINERS.has(tag) || tag === '') {
			walkBlocks(n.childNodes, out); // recurse into wrappers
		} else if (hasBlockChild(n)) {
			walkBlocks(n.childNodes, out);
		} else {
			const text = inlineHtml(n);
			if (text) out.push({ type: 'paragraph', data: { text } });
		}
	}
}

export function htmlToBlocks(html) {
	const root = parse(String(html || ''), { blockTextElements: {} });
	const blocks = [];
	walkBlocks(root.childNodes, blocks);
	// Never emit an empty document; a single empty paragraph keeps the editor happy.
	if (!blocks.length) blocks.push({ type: 'paragraph', data: { text: '' } });
	return { time: Date.now(), blocks, version: EDITORJS_VERSION };
}

async function main() {
	const { Client } = pg;
	const client = new Client({
		host: process.env.PGHOST || '127.0.0.1',
		port: Number(process.env.PGPORT || 5432),
		user: process.env.PGUSER || 'directus',
		database: process.env.PGDATABASE || 'directus',
		password: process.env.PGPASSWORD,
	});
	await client.connect();

	// Fails fast with a clear message if the bio field hasn't been created yet.
	try {
		await client.query('SELECT bio FROM people_translations LIMIT 1');
	} catch {
		console.error('✖ Column people_translations.bio not found. Create the `bio` field in Directus first (Type: JSON, Interface: custom block editor).');
		await client.end();
		process.exit(1);
	}

	const where = OVERWRITE
		? "biography IS NOT NULL AND biography <> ''"
		: "biography IS NOT NULL AND biography <> '' AND bio IS NULL";
	const { rows } = await client.query(`SELECT id, biography FROM people_translations WHERE ${where} ORDER BY id`);

	console.log(`${rows.length} row(s) to convert. Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}${OVERWRITE ? ' + overwrite' : ''}\n`);

	let written = 0;
	for (const row of rows) {
		const doc = htmlToBlocks(row.biography);
		if (APPLY) {
			await client.query('UPDATE people_translations SET bio = $1 WHERE id = $2', [doc, row.id]);
			written++;
		} else {
			console.log(`--- id ${row.id} ---`);
			console.log('  biography:', JSON.stringify(row.biography));
			console.log('  bio      :', JSON.stringify(doc.blocks));
		}
	}

	if (APPLY) console.log(`✔ Updated ${written} row(s).`);
	else console.log('\nDry run only. Re-run with --apply to write.');

	await client.end();
}

// Only connect/run when executed directly — importing the module (e.g. for
// testing htmlToBlocks) must have no side effects.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}

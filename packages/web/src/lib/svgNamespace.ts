export function namespaceSvgGradients(svgContent: string, namespace: string): string {
	// SVG IDs are document-wide, including clip paths and filters. Only rewrite
	// locally defined IDs so references to shared layout definitions still work.
	const prefix = encodeURIComponent(namespace);
	const ids = new Set([...svgContent.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
	return svgContent
		.replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${prefix}_${id}"`)
		.replace(/url\(#([^)]+)\)/g, (reference, id: string) =>
			ids.has(id) ? `url(#${prefix}_${id})` : reference
		)
		.replace(/\b((?:xlink:)?href)="#([^"]+)"/g, (reference, attribute: string, id: string) =>
			ids.has(id) ? `${attribute}="#${prefix}_${id}"` : reference
		);
}

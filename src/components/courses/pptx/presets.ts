import { parseXml } from './xml';

let shapes = new Map<string, Element>();

export async function loadPresets() {
  if (shapes.size) return;
  const { default: definitions } = await import('./presetShapeDefinitions.xml?raw');
  shapes = new Map(
    Array.from(parseXml(definitions).documentElement.children).map((el) => [el.localName, el]),
  );
}

export const presetGeometry = (name: string) => shapes.get(name);

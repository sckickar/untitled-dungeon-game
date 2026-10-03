const rules = new Map();

export function on(event, fn, { priority = 0 } = {}) {
  const list = rules.get(event) || [];
  const entry = { fn, priority };
  list.push(entry);
  list.sort((a, b) => b.priority - a.priority);
  rules.set(event, list);
  return () => list.splice(list.indexOf(entry), 1);
}

export function runRules(event, payload, world) {
  const list = rules.get(event);
  if (list) for (const r of [...list]) r.fn(payload, world);
}

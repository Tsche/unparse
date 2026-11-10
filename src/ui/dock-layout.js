/** A small binary dock tree. Leaves are pane IDs; splits hold a live ratio. */
export const leaf = (id) => ({ type: "leaf", id });
export const split = (direction, first, second, ratio = 50) => ({
  type: "split",
  direction,
  first,
  second,
  ratio,
});
export function contains(tree, id) {
  return tree.type === "leaf"
    ? tree.id === id
    : contains(tree.first, id) || contains(tree.second, id);
}
export function removePane(tree, id) {
  if (tree.type === "leaf") return tree.id === id ? null : tree;
  const first = removePane(tree.first, id),
    second = removePane(tree.second, id);
  if (!first) return second;
  if (!second) return first;
  return { ...tree, first, second };
}
export function insertPane(tree, id, target, edge) {
  if (tree.type === "leaf") {
    if (tree.id !== target) return tree;
    const direction = edge === "top" || edge === "bottom" ? "column" : "row";
    return edge === "top" || edge === "left"
      ? split(direction, leaf(id), tree)
      : split(direction, tree, leaf(id));
  }
  return {
    ...tree,
    first: insertPane(tree.first, id, target, edge),
    second: insertPane(tree.second, id, target, edge),
  };
}
export function movePane(tree, id, target, edge) {
  if (id === target || !contains(tree, id) || !contains(tree, target))
    return tree;
  return insertPane(removePane(tree, id), id, target, edge);
}
export function paneIds(tree) {
  return tree.type === "leaf"
    ? [tree.id]
    : [...paneIds(tree.first), ...paneIds(tree.second)];
}

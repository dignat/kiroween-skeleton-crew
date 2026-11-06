// Renders the editable ingredient chips (task 20.4). Each chip has a remove
// button with an accessible label. Shows a gentle empty message when the list
// is empty.

/** Renders chips for each ingredient; the remove button calls onRemove(name). */
export function renderChips(
  container: HTMLUListElement,
  ingredients: readonly string[],
  onRemove: (name: string) => void,
): void {
  container.replaceChildren();

  if (ingredients.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-chips';
    li.textContent = 'No ingredients yet. Add one below or choose a photo.';
    container.append(li);
    return;
  }

  for (const name of ingredients) {
    const li = document.createElement('li');
    li.className = 'chip';

    const label = document.createElement('span');
    label.textContent = name;
    li.append(label);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Remove ${name}`);
    remove.addEventListener('click', () => onRemove(name));
    li.append(remove);

    container.append(li);
  }
}

/** Renders the quick-add buttons; clicking one calls onAdd(name). */
export function renderQuickAdd(
  container: HTMLUListElement,
  options: readonly string[],
  have: ReadonlySet<string>,
  onAdd: (name: string) => void,
): void {
  container.replaceChildren();
  for (const name of options) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `+ ${name}`;
    button.disabled = have.has(name);
    button.setAttribute('aria-label', `Add ${name}`);
    button.addEventListener('click', () => onAdd(name));
    li.append(button);
    container.append(li);
  }
}

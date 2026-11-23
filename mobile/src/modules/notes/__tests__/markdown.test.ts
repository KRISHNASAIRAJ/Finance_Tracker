import {
  checklistProgress, exportAsText, formatRange, moveCheckedToBottom,
  previewFromBody, stripMarkdown, titleFromBody, toggleChecklistItem,
} from '../markdown';

describe('title and preview rules', () => {
  it('uses the first non-empty line as the title', () => {
    expect(titleFromBody('\n\n# Grocery list\n\nBuy things')).toBe('Grocery list');
  });

  it('strips markdown from the title', () => {
    expect(titleFromBody('**Money** rules')).toBe('Money rules');
  });

  it('falls back to New Note for an empty body', () => {
    expect(titleFromBody('  \n\n')).toBe('New Note');
  });

  it('takes the next lines as a two-line markdown-free preview', () => {
    const body = 'Grocery list\n\nThings to **pick up** this week.\n- [x] Jaggery\n- Handwash\nMore';
    expect(previewFromBody(body)).toBe('Things to pick up this week. Jaggery');
  });

  it('strips links, quotes and headings for clean previews', () => {
    expect(stripMarkdown('## Heading\n> quoted [site](https://x) `code`'))
      .toBe('Heading quoted site code');
  });
});

describe('checklists', () => {
  const body = 'List\n\n- [x] Jaggery\n- [ ] Soaps\n- [x] Handwash';

  it('counts done and total', () => {
    expect(checklistProgress(body)).toEqual({ done: 2, total: 3 });
  });

  it('toggles only the requested line', () => {
    expect(toggleChecklistItem(body, 3)).toBe('List\n\n- [x] Jaggery\n- [x] Soaps\n- [x] Handwash');
    expect(toggleChecklistItem(body, 2)).toBe('List\n\n- [ ] Jaggery\n- [ ] Soaps\n- [x] Handwash');
    expect(toggleChecklistItem(body, 1)).toBe(body);
  });

  it('moves checked items to the bottom on request', () => {
    expect(moveCheckedToBottom(body)).toBe('List\n\n- [ ] Soaps\n- [x] Jaggery\n- [x] Handwash');
  });
});

describe('formatting actions', () => {
  it('wraps a selection with bold markers and toggles them off again', () => {
    const body = 'hello world';
    const first = formatRange(body, 0, 5, 'bold');
    expect(first.text).toBe('**hello** world');
    expect(first.selectionStart).toBe(2);
    expect(first.selectionEnd).toBe(7);
    const second = formatRange(first.text, 2, 7, 'bold');
    expect(second.text).toBe(body);
  });

  it('applies underline and strikethrough tokens', () => {
    expect(formatRange('text', 0, 4, 'underline').text).toBe('<u>text</u>');
    expect(formatRange('text', 0, 4, 'strikethrough').text).toBe('~~text~~');
  });

  it('applies line prefixes for headings, lists and quotes', () => {
    expect(formatRange('one\ntwo', 0, 7, 'heading').text).toBe('## one\n## two');
    expect(formatRange('one', 0, 3, 'numbered').text).toBe('1. one');
    expect(formatRange('one', 0, 3, 'quote').text).toBe('> one');
    expect(formatRange('one', 0, 3, 'checklist').text).toBe('- [ ] one');
  });

  it('indents and outdents selected lines', () => {
    expect(formatRange('one', 0, 3, 'indent').text).toBe('  one');
    expect(formatRange('  one', 0, 5, 'outdent').text).toBe('one');
  });

  it('inserts a table skeleton', () => {
    expect(formatRange('', 0, 0, 'table').text).toContain('| --- | --- |');
  });
});

describe('export', () => {
  it('produces clean markdown with optional tags', () => {
    expect(exportAsText('Title\n\nBody  text', ['idea', '#money']))
      .toBe('Title\n\nBody text\n\n#idea #money\n');
  });

  it('stays smooth on a 100k character note', () => {
    const big = `${'Title'}\n\n${'word '.repeat(20000)}`;
    expect(big.length).toBeGreaterThan(100000);
    const t0 = Date.now();
    expect(titleFromBody(big)).toBe('Title');
    expect(checklistProgress(big).total).toBe(0);
    expect(previewFromBody(big).length).toBeGreaterThan(0);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

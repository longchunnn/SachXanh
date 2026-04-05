type BookWithId = {
  id: string | number;
};

export function dedupeBooksById<T extends BookWithId>(books: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  books.forEach((book) => {
    const id = String(book.id);
    if (seen.has(id)) return;

    seen.add(id);
    result.push(book);
  });

  return result;
}

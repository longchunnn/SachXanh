import axiosClient from "./axiosClient";
import { normalizeBook, type ApiBook } from "../utils/apiMappers";

export async function getBooks(): Promise<ApiBook[]> {
  const response = (await axiosClient.get("/books")) as unknown;
  if (!Array.isArray(response)) return [];
  return response.map((entry) => normalizeBook(entry));
}

export async function getBookById(bookId: string): Promise<ApiBook> {
  const response = (await axiosClient.get(
    `/books/${encodeURIComponent(bookId)}`,
  )) as unknown;
  return normalizeBook(response);
}

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'crm-page-size';
const DEFAULT_PAGE_SIZE = 5;

function readStoredPageSize(): number {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (n > 0) return n;
    }
  } catch {}
  return DEFAULT_PAGE_SIZE;
}

function writeStoredPageSize(size: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(size));
  } catch {}
}

export function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE);

  // Read from localStorage on mount
  useEffect(() => {
    setPageSizeState(readStoredPageSize());
  }, []);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Reset to page 1 when the filtered list changes
  useEffect(() => {
    setPage(1);
  }, [totalItems]);

  // Clamp page to valid range
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) {
    // Will be corrected on next render
  }

  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    writeStoredPageSize(size);
    setPage(1);
  }, []);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return {
    paginatedItems,
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    startItem,
    endItem,
  };
}

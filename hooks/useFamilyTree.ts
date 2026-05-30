"use client";

import { useEffect, useCallback } from "react";
import { useFamilyTreeStore } from "@/lib/store";
import { treeApi } from "@/lib/api";
import { computeTreeLayout } from "@/lib/utils";

export function useFamilyTree() {
  const store = useFamilyTreeStore();

  const fetchTree = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);
    try {
      const tree = await treeApi.getTree();
      if (tree.persons.length > 0) {
        const personsWithPositions = computeTreeLayout(
          tree.persons,
          tree.relationships
        );
        store.setTree({ ...tree, persons: personsWithPositions });
      }
    } catch {
      // Use demo data if API fails
      store.setError(null);
    } finally {
      store.setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  return {
    ...store,
    refetch: fetchTree,
  };
}

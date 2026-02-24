import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApiClient } from "../api/client";

/**
 * Notes domain contract used by UI.
 * Invariants:
 * - `notes` is always an array (possibly empty)
 * - `selectedId` is either null or matches an id from `notes` (best-effort enforced)
 */

/**
 * @typedef {Object} Note
 * @property {string|number} id
 * @property {string} title
 * @property {string} content
 * @property {string} [updated_at]
 * @property {string} [created_at]
 */

/**
 * @typedef {Object} NotesFlowState
 * @property {Note[]} notes
 * @property {string|number|null} selectedId
 * @property {boolean} isLoadingList
 * @property {boolean} isSaving
 * @property {boolean} isDeleting
 * @property {string|null} error
 */

/**
 * Resolve backend base URL.
 * IMPORTANT: .env is present but container_env list is "None" in the task context.
 * We still support REACT_APP_NOTES_API_BASE_URL if later provided.
 */
function resolveBaseUrl() {
  const envBase = process.env.REACT_APP_NOTES_API_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, "");
  // Default for local dev/proxy setups; in this environment backend is on :3001.
  return "http://localhost:3001";
}

/**
 * Convert backend note shape to UI note shape.
 * Kept as a separate pure function to avoid scattered mapping logic.
 */
function normalizeNote(raw) {
  return {
    id: raw.id,
    title: raw.title ?? "",
    content: raw.content ?? "",
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

// PUBLIC_INTERFACE
export function useNotesFlow() {
  /** Reusable notes CRUD flow with consistent loading/error states. */
  const api = useMemo(() => createApiClient({ baseUrl: resolveBaseUrl() }), []);
  const [state, setState] = useState(
    /** @type {NotesFlowState} */ ({
      notes: [],
      selectedId: null,
      isLoadingList: false,
      isSaving: false,
      isDeleting: false,
      error: null,
    })
  );

  // Keep draft separate so we can allow editing without immediately saving.
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [isDirty, setIsDirty] = useState(false);

  const listAbortRef = useRef(null);

  const selectedNote = useMemo(() => {
    return state.notes.find((n) => String(n.id) === String(state.selectedId)) ?? null;
  }, [state.notes, state.selectedId]);

  // When selection changes, sync draft to selected note.
  useEffect(() => {
    if (!selectedNote) {
      setDraft({ title: "", content: "" });
      setIsDirty(false);
      return;
    }
    setDraft({ title: selectedNote.title, content: selectedNote.content });
    setIsDirty(false);
  }, [selectedNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setError = useCallback((message) => {
    setState((s) => ({ ...s, error: message }));
  }, []);

  const clearError = useCallback(() => setError(null), [setError]);

  const listNotes = useCallback(async () => {
    // Cancel any in-flight list request (important when hot reloading or quick refreshes).
    listAbortRef.current?.abort?.();
    const controller = new AbortController();
    listAbortRef.current = controller;

    setState((s) => ({ ...s, isLoadingList: true, error: null }));

    try {
      const raw = await api.listNotes({ signal: controller.signal });
      const notes = Array.isArray(raw) ? raw.map(normalizeNote) : [];
      setState((s) => {
        // Preserve selection if possible; otherwise select first note.
        let nextSelectedId = s.selectedId;
        if (nextSelectedId != null) {
          const stillExists = notes.some((n) => String(n.id) === String(nextSelectedId));
          if (!stillExists) nextSelectedId = null;
        }
        if (nextSelectedId == null && notes.length > 0) nextSelectedId = notes[0].id;

        return { ...s, notes, selectedId: nextSelectedId, isLoadingList: false };
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setState((s) => ({ ...s, isLoadingList: false }));
      setError("Failed to load notes. Please try again.");
    }
  }, [api, setError]);

  useEffect(() => {
    listNotes();
    return () => listAbortRef.current?.abort?.();
  }, [listNotes]);

  const selectNote = useCallback((id) => {
    setState((s) => ({ ...s, selectedId: id }));
  }, []);

  const updateDraft = useCallback((patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setIsDirty(true);
  }, []);

  const createNewNote = useCallback(async () => {
    setState((s) => ({ ...s, isSaving: true, error: null }));
    try {
      const created = await api.createNote(
        { title: "Untitled", content: "" },
        {}
      );
      const note = normalizeNote(created);
      setState((s) => ({
        ...s,
        notes: [note, ...s.notes],
        selectedId: note.id,
        isSaving: false,
      }));
      // draft sync will happen via selectedNote effect
    } catch {
      setState((s) => ({ ...s, isSaving: false }));
      setError("Failed to create note.");
    }
  }, [api, setError]);

  const saveSelected = useCallback(async () => {
    clearError();

    const id = state.selectedId;
    if (id == null) {
      setError("No note selected.");
      return;
    }

    setState((s) => ({ ...s, isSaving: true }));

    try {
      const updated = await api.updateNote(
        id,
        { title: draft.title, content: draft.content },
        {}
      );
      const note = normalizeNote(updated);

      setState((s) => ({
        ...s,
        notes: s.notes.map((n) => (String(n.id) === String(id) ? note : n)),
        isSaving: false,
      }));
      setIsDirty(false);
    } catch {
      setState((s) => ({ ...s, isSaving: false }));
      setError("Failed to save note.");
    }
  }, [api, clearError, draft.content, draft.title, setError, state.selectedId]);

  const deleteSelected = useCallback(async () => {
    clearError();

    const id = state.selectedId;
    if (id == null) {
      setError("No note selected.");
      return;
    }

    setState((s) => ({ ...s, isDeleting: true }));

    try {
      await api.deleteNote(id, {});
      setState((s) => {
        const remaining = s.notes.filter((n) => String(n.id) !== String(id));
        const nextSelectedId = remaining.length > 0 ? remaining[0].id : null;
        return { ...s, notes: remaining, selectedId: nextSelectedId, isDeleting: false };
      });
      setIsDirty(false);
    } catch {
      setState((s) => ({ ...s, isDeleting: false }));
      setError("Failed to delete note.");
    }
  }, [api, clearError, setError, state.selectedId]);

  return {
    state,
    selectedNote,
    draft,
    isDirty,

    // Actions
    listNotes,
    selectNote,
    updateDraft,
    createNewNote,
    saveSelected,
    deleteSelected,
    clearError,
  };
}
